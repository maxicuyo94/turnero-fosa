import { describe, expect, it } from "vitest";
import {
  canAcceptAppointment,
  createAppointmentReservation,
  getAvailableSlots,
} from "@/src/modules/availability";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
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
      date: monday,
      serviceDurationMinutes: 30,
      appointments,
      now,
    }).map((slot) => slot.startTime);

    expect(slots).not.toContain("09:30");
    expect(slots).toContain("10:00");
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
