import { describe, expect, it } from "vitest";
import {
  canAcceptAppointment,
  createAppointmentReservation,
  getAvailableSlots,
  getInternalAvailableSlots,
  validateAppointmentInterval,
} from "@/src/modules/availability";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import { scheduleDateExceptionSchema } from "@/src/modules/settings/schemas";
import { appointmentSchema } from "@/src/modules/appointments/schemas";
import { serviceSchema } from "@/src/modules/catalog/schemas";
import { customerSchema, motorcycleSchema } from "@/src/modules/customers/schemas";

const monday = "2026-07-06";
const now = new Date("2026-07-01T09:00:00-03:00");

describe("domain schemas", () => {
  it("validates configurable services, customers, motorcycles, and appointments", () => {
    expect(serviceSchema.parse(workshopSeedConfig.services[0])).toMatchObject({
      name: "Service Esencial",
      durationMinutes: 60,
      isActive: true,
    });

    expect(
      customerSchema.parse({
        fullName: "Ada Lovelace",
        phone: "+5491112345678",
        email: "ada@example.com",
      }),
    ).toEqual({ fullName: "Ada Lovelace", phone: "+5491112345678", email: "ada@example.com" });

    expect(
      motorcycleSchema.parse({ brand: "Honda", model: "XR", licensePlate: "ABC123" }),
    ).toEqual({ brand: "Honda", model: "XR", licensePlate: "ABC123" });

    expect(
      appointmentSchema.parse({
        startAt: new Date(`${monday}T09:00:00-03:00`),
        endAt: new Date(`${monday}T09:30:00-03:00`),
        status: "PENDING_CONFIRMATION",
      }),
    ).toMatchObject({ status: "PENDING_CONFIRMATION" });
  });

  it("rejects invalid domain input before persistence", () => {
    expect(() => serviceSchema.parse({ name: "", durationMinutes: 0, isActive: true, displayOrder: 1 })).toThrow();
    expect(() => customerSchema.parse({ fullName: "", phone: "" })).toThrow();
    expect(() => motorcycleSchema.parse({ brand: "", model: "" })).toThrow();
  });
});

describe("getAvailableSlots", () => {
  it("returns slots inside configured hours and excludes lunch break", () => {
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    });

    expect(slots.map((slot) => slot.startTime)).toContain("09:00");
    expect(slots.map((slot) => slot.startTime)).toContain("12:00");
    expect(slots.map((slot) => slot.startTime)).toContain("15:00");
    expect(slots.map((slot) => slot.startTime)).not.toContain("13:00");
    expect(slots.map((slot) => slot.startTime)).not.toContain("14:30");
  });

  it("rejects closed days, past starts, and dates outside the booking policy", () => {
    expect(
      getAvailableSlots({
        settings: workshopSeedConfig.settings,
        schedules: workshopSeedConfig.schedules,
        breaks: workshopSeedConfig.breaks,
        exceptions: [],
        date: "2026-07-05",
        serviceDurationMinutes: 60,
        appointments: [],
        now,
      }),
    ).toEqual([]);

    expect(
      getAvailableSlots({
        settings: workshopSeedConfig.settings,
        schedules: workshopSeedConfig.schedules,
        breaks: workshopSeedConfig.breaks,
        exceptions: [],
        date: "2026-07-01",
        serviceDurationMinutes: 30,
        appointments: [],
        now: new Date("2026-07-01T08:30:00-03:00"),
      }).map((slot) => slot.startTime),
    ).not.toContain("09:00");

    expect(
      getAvailableSlots({
        settings: workshopSeedConfig.settings,
        schedules: workshopSeedConfig.schedules,
        breaks: workshopSeedConfig.breaks,
        exceptions: [],
        date: "2026-08-15",
        serviceDurationMinutes: 30,
        appointments: [],
        now,
      }),
    ).toEqual([]);
  });

  it("uses service duration to keep appointments within a single working interval", () => {
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      serviceDurationMinutes: 120,
      appointments: [],
      now,
    }).map((slot) => slot.startTime);

    expect(slots).toContain("09:00");
    expect(slots).toContain("11:00");
    expect(slots).toContain("15:00");
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("18:00");
  });

  it("applies configurable overlapping capacity and ignores cancelled appointments", () => {
    const appointments = [
      interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED"),
      interval("2026-07-06T09:30:00-03:00", "2026-07-06T10:30:00-03:00", "PENDING_CONFIRMATION"),
      interval("2026-07-06T10:00:00-03:00", "2026-07-06T11:00:00-03:00", "CANCELLED"),
    ];

    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      serviceDurationMinutes: 30,
      appointments,
      now,
    }).map((slot) => slot.startTime);

    expect(slots).not.toContain("09:30");
    expect(slots).toContain("10:00");
  });
});

describe("date exceptions", () => {
  it("returns no slots for a national holiday imported as a closed date", () => {
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [closedException(monday, "Feriado nacional")],
      date: monday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    });

    expect(slots).toEqual([]);
  });

  it("opens a normally closed date within the exception hours", () => {
    const sunday = "2026-07-05";

    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [openException(sunday, "10:00", "13:00")],
      date: sunday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    }).map((slot) => slot.startTime);

    expect(slots).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
  });

  it("takes precedence over the weekly schedule of the same weekday", () => {
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [openException(monday, "10:00", "12:00")],
      date: monday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    }).map((slot) => slot.startTime);

    expect(slots).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("keeps breaks, notice, and booking window policies on an exceptionally open date", () => {
    const exceptions = [openException(monday, "09:00", "19:00")];
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions,
      date: monday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    }).map((slot) => slot.startTime);

    expect(slots).toContain("09:00");
    expect(slots).not.toContain("13:00");
    expect(
      getAvailableSlots({
        settings: workshopSeedConfig.settings,
        schedules: workshopSeedConfig.schedules,
        breaks: workshopSeedConfig.breaks,
        exceptions: [openException("2026-08-15", "09:00", "19:00")],
        date: "2026-08-15",
        serviceDurationMinutes: 60,
        appointments: [],
        now,
      }),
    ).toEqual([]);
  });

  it("ignores exceptions stored for other dates", () => {
    const slots = getAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [closedException("2026-07-07", "Feriado nacional")],
      date: monday,
      serviceDurationMinutes: 60,
      appointments: [],
      now,
    }).map((slot) => slot.startTime);

    expect(slots).toContain("09:00");
  });
});

describe("scheduleDateExceptionSchema", () => {
  it("accepts a closed exception without hours and an open exception with valid hours", () => {
    expect(scheduleDateExceptionSchema.parse(closedException(monday, "Feriado nacional"))).toMatchObject({
      date: monday,
      isOpen: false,
      source: "IMPORTED",
    });
    expect(scheduleDateExceptionSchema.parse(openException(monday, "10:00", "13:00"))).toMatchObject({
      isOpen: true,
      opensAt: "10:00",
      closesAt: "13:00",
      manualOverride: true,
    });
  });

  it("rejects an open exception without hours or with an inverted range", () => {
    expect(() =>
      scheduleDateExceptionSchema.parse({ ...openException(monday, "10:00", "13:00"), opensAt: null, closesAt: null }),
    ).toThrow();
    expect(() => scheduleDateExceptionSchema.parse(openException(monday, "13:00", "10:00"))).toThrow();
  });
});

describe("appointment capacity guard", () => {
  it("accepts an appointment when capacity remains for the full service duration", () => {
    expect(
      canAcceptAppointment({
        settings: workshopSeedConfig.settings,
        startAt: new Date("2026-07-06T09:00:00-03:00"),
        serviceDurationMinutes: 60,
        appointments: [interval("2026-07-06T09:30:00-03:00", "2026-07-06T10:30:00-03:00", "CONFIRMED")],
      }),
    ).toEqual({ accepted: true, endAt: new Date("2026-07-06T10:00:00-03:00") });
  });

  it("rejects a booking when overlapping appointments exhaust capacity", () => {
    expect(
      canAcceptAppointment({
        settings: workshopSeedConfig.settings,
        startAt: new Date("2026-07-06T09:30:00-03:00"),
        serviceDurationMinutes: 30,
        appointments: [
          interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED"),
          interval("2026-07-06T09:15:00-03:00", "2026-07-06T10:15:00-03:00", "PENDING_CONFIRMATION"),
        ],
      }),
    ).toEqual({ accepted: false, reason: "CAPACITY_EXHAUSTED" });
  });

  it("rechecks the latest overlap state before creating the final-capacity appointment", async () => {
    const repository = new InMemoryAppointmentRepository([
      interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED"),
    ]);

    const first = await createAppointmentReservation({
      repository,
      settings: workshopSeedConfig.settings,
      input: { idempotencyKey: "first", startAt: new Date("2026-07-06T09:30:00-03:00"), serviceDurationMinutes: 30 },
    });
    const second = await createAppointmentReservation({
      repository,
      settings: workshopSeedConfig.settings,
      input: { idempotencyKey: "second", startAt: new Date("2026-07-06T09:30:00-03:00"), serviceDurationMinutes: 30 },
    });

    expect(first).toMatchObject({ accepted: true });
    expect(second).toEqual({ accepted: false, reason: "CAPACITY_EXHAUSTED" });
    expect(repository.savedCount).toBe(1);
  });

  it("returns the existing reservation for a repeated idempotency key", async () => {
    const repository = new InMemoryAppointmentRepository([]);
    const input = { idempotencyKey: "same-form", startAt: new Date("2026-07-06T09:30:00-03:00"), serviceDurationMinutes: 30 };

    const first = await createAppointmentReservation({ repository, settings: workshopSeedConfig.settings, input });
    const second = await createAppointmentReservation({ repository, settings: workshopSeedConfig.settings, input });

    expect(first).toMatchObject({ accepted: true });
    expect(second).toEqual(first);
    expect(repository.savedCount).toBe(1);
  });
});

describe("internal appointment interval validation", () => {
  it("accepts shortening and excludes the edited appointment from capacity", () => {
    const result = validateAppointmentInterval({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      startTime: "09:00",
      durationMinutes: 60,
      serviceMinimumDurationMinutes: 30,
      excludeAppointmentId: "edited",
      appointments: [
        { id: "edited", ...interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:30:00-03:00", "CONFIRMED") },
        { id: "other", ...interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED") },
      ],
    });

    expect(result).toEqual({
      accepted: true,
      startAt: new Date("2026-07-06T09:00:00-03:00"),
      endAt: new Date("2026-07-06T10:00:00-03:00"),
      remainingCapacity: 1,
    });
  });

  it("rejects a longer interval when capacity is exhausted", () => {
    const result = validateAppointmentInterval({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      startTime: "09:00",
      durationMinutes: 120,
      serviceMinimumDurationMinutes: 60,
      excludeAppointmentId: "edited",
      appointments: [
        { id: "edited", ...interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED") },
        { id: "first", ...interval("2026-07-06T10:00:00-03:00", "2026-07-06T11:30:00-03:00", "CONFIRMED") },
        { id: "second", ...interval("2026-07-06T10:30:00-03:00", "2026-07-06T11:30:00-03:00", "PENDING_CONFIRMATION") },
      ],
    });

    expect(result).toEqual({ accepted: false, reason: "CAPACITY_EXHAUSTED" });
  });

  it("accepts a long interval when existing appointments are back-to-back rather than simultaneous", () => {
    const result = validateAppointmentInterval({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      startTime: "09:00",
      durationMinutes: 120,
      serviceMinimumDurationMinutes: 60,
      appointments: [
        interval("2026-07-06T09:00:00-03:00", "2026-07-06T10:00:00-03:00", "CONFIRMED"),
        interval("2026-07-06T10:00:00-03:00", "2026-07-06T11:00:00-03:00", "CONFIRMED"),
      ],
    });

    expect(result).toEqual({
      accepted: true,
      startAt: new Date("2026-07-06T09:00:00-03:00"),
      endAt: new Date("2026-07-06T11:00:00-03:00"),
      remainingCapacity: 1,
    });
  });

  it("rejects invalid durations, holidays, breaks, and intervals outside opening hours", () => {
    const base = {
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      startTime: "09:00",
      durationMinutes: 60,
      serviceMinimumDurationMinutes: 60,
      appointments: [],
    };

    expect(validateAppointmentInterval({ ...base, durationMinutes: 45 })).toEqual({ accepted: false, reason: "INVALID_DURATION" });
    expect(validateAppointmentInterval({ ...base, exceptions: [closedException(monday, "Feriado nacional")] })).toEqual({ accepted: false, reason: "CLOSED_DATE" });
    expect(validateAppointmentInterval({ ...base, startTime: "13:00" })).toEqual({ accepted: false, reason: "BREAK_OVERLAP" });
    expect(validateAppointmentInterval({ ...base, startTime: "18:30" })).toEqual({ accepted: false, reason: "OUTSIDE_OPENING_HOURS" });
  });

  it("uses exceptional opening hours and rejects intervals that cross the local day boundary", () => {
    const exceptional = validateAppointmentInterval({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: [],
      exceptions: [openException("2026-07-05", "10:00", "13:00")],
      date: "2026-07-05",
      startTime: "12:00",
      durationMinutes: 60,
      serviceMinimumDurationMinutes: 30,
      appointments: [],
    });
    const dayBoundary = validateAppointmentInterval({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: [],
      exceptions: [openException(monday, "00:00", "23:59")],
      date: monday,
      startTime: "23:30",
      durationMinutes: 60,
      serviceMinimumDurationMinutes: 30,
      appointments: [],
    });

    expect(exceptional).toMatchObject({ accepted: true, endAt: new Date("2026-07-05T13:00:00-03:00") });
    expect(dayBoundary).toEqual({ accepted: false, reason: "DAY_BOUNDARY_EXCEEDED" });
  });

  it("ignores every non-capacity status and lists only valid internal start times", () => {
    const appointments = ["COMPLETED", "CANCELLED", "NO_SHOW"].flatMap((status, index) => [
      {
        id: `ignored-${index}`,
        startAt: new Date("2026-07-06T09:00:00-03:00"),
        endAt: new Date("2026-07-06T10:00:00-03:00"),
        status: status as "COMPLETED" | "CANCELLED" | "NO_SHOW",
      },
    ]);

    const slots = getInternalAvailableSlots({
      settings: workshopSeedConfig.settings,
      schedules: workshopSeedConfig.schedules,
      breaks: workshopSeedConfig.breaks,
      exceptions: [],
      date: monday,
      durationMinutes: 60,
      serviceMinimumDurationMinutes: 30,
      appointments,
      excludeAppointmentId: "edited",
    });

    expect(slots.map((slot) => slot.startTime)).toContain("09:00");
    expect(slots.map((slot) => slot.startTime)).not.toContain("13:00");
    expect(slots.at(-1)?.startTime).toBe("18:00");
  });
});

function closedException(date: string, label: string) {
  return { date, label, source: "IMPORTED" as const, manualOverride: false, isOpen: false, opensAt: null, closesAt: null };
}

function openException(date: string, opensAt: string, closesAt: string) {
  return { date, label: "Apertura excepcional", source: "MANUAL" as const, manualOverride: true, isOpen: true, opensAt, closesAt };
}

function interval(start: string, end: string, status: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED") {
  return { startAt: new Date(start), endAt: new Date(end), status };
}

class InMemoryAppointmentRepository {
  private appointments: ReturnType<typeof interval>[];
  private reservations = new Map<string, Awaited<ReturnType<typeof createAppointmentReservation>>>();
  savedCount = 0;

  constructor(appointments: ReturnType<typeof interval>[]) {
    this.appointments = appointments;
  }

  async findByIdempotencyKey(key: string) {
    return this.reservations.get(key) ?? null;
  }

  async withCapacityLock<T>(operation: (appointments: ReturnType<typeof interval>[]) => Promise<T>) {
    return operation(this.appointments);
  }

  async save(input: { idempotencyKey: string; startAt: Date; endAt: Date }) {
    this.savedCount += 1;
    this.appointments.push({ startAt: input.startAt, endAt: input.endAt, status: "PENDING_CONFIRMATION" });
    const reservation = { accepted: true as const, appointment: { startAt: input.startAt, endAt: input.endAt } };
    this.reservations.set(input.idempotencyKey, reservation);
    return reservation;
  }
}
