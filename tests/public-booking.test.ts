import { describe, expect, it } from "vitest";
import {
  cancelPublicAppointment,
  createPublicBooking,
  getPublicAvailability,
  getPublicAppointmentStatus,
  listPublicServices,
  type BookingRepository,
  type PublicAppointmentRecord,
  type PublicServiceRecord,
} from "@/src/modules/booking/service";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import type { EmailNotificationDraft } from "@/src/modules/notifications/service";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

const monday = "2026-07-06";
const now = new Date("2026-07-01T09:00:00-03:00");

describe("public booking services and availability", () => {
  it("lists only active services in display order", async () => {
    const repository = new InMemoryBookingRepository({
      services: [
        service({ id: "second", name: "Second", displayOrder: 2, isActive: true }),
        service({ id: "inactive", name: "Inactive", displayOrder: 1, isActive: false }),
        service({ id: "first", name: "First", displayOrder: 1, isActive: true }),
      ],
    });

    await expect(listPublicServices(repository)).resolves.toEqual([
      expect.objectContaining({ id: "first", name: "First" }),
      expect.objectContaining({ id: "second", name: "Second" }),
    ]);
  });

  it("returns slots for an active long service and rejects inactive services", async () => {
    const repository = new InMemoryBookingRepository({
      services: [service({ id: "long", durationMinutes: 120 }), service({ id: "hidden", isActive: false })],
    });

    const available = await getPublicAvailability(repository, { serviceId: "long", date: monday, now });
    const inactive = await getPublicAvailability(repository, { serviceId: "hidden", date: monday, now });

    expect(available.accepted).toBe(true);
    expect(available.accepted ? available.slots.map((slot) => slot.startTime) : []).toEqual(
      expect.arrayContaining(["09:00", "11:00", "15:00"]),
    );
    expect(available.accepted ? available.slots.map((slot) => slot.startTime) : []).not.toContain("12:00");
    expect(inactive).toEqual({ accepted: false, reason: "SERVICE_UNAVAILABLE" });
  });

  it("hides every slot of a date persisted as a closed exception", async () => {
    const repository = new InMemoryBookingRepository({
      services: [service({ id: "oil", durationMinutes: 30 })],
      exceptions: [
        {
          date: monday,
          label: "Feriado nacional",
          source: "IMPORTED",
          manualOverride: false,
          isOpen: false,
          opensAt: null,
          closesAt: null,
        },
      ],
    });

    const available = await getPublicAvailability(repository, { serviceId: "oil", date: monday, now });

    expect(available).toMatchObject({ accepted: true, slots: [] });
  });

  it("uses the service duration by default and recalculates slots for a longer requested duration", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 60 })] });

    const defaultAvailability = await getPublicAvailability(repository, { serviceId: "oil", date: monday, now });
    const extendedAvailability = await getPublicAvailability(repository, {
      serviceId: "oil",
      date: monday,
      durationMinutes: 90,
      now,
    });

    expect(defaultAvailability.accepted ? defaultAvailability.slots[0]?.endAt.getTime() - defaultAvailability.slots[0]?.startAt.getTime() : 0)
      .toBe(60 * 60_000);
    expect(extendedAvailability.accepted ? extendedAvailability.slots[0]?.endAt.getTime() - extendedAvailability.slots[0]?.startAt.getTime() : 0)
      .toBe(90 * 60_000);
  });

  it("rejects durations below the service default or outside the configured slot step", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 60 })] });

    await expect(getPublicAvailability(repository, { serviceId: "oil", date: monday, durationMinutes: 30, now }))
      .resolves.toMatchObject({ accepted: false, reason: "INVALID_DURATION" });
    await expect(getPublicAvailability(repository, { serviceId: "oil", date: monday, durationMinutes: 75, now }))
      .resolves.toMatchObject({ accepted: false, reason: "INVALID_DURATION" });
  });
});

describe("createPublicBooking", () => {
  it("rejects missing contact data before creating an appointment", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil" })] });

    const result = await createPublicBooking(repository, {
      serviceId: "oil",
      date: monday,
      startTime: "09:00",
      customer: { fullName: "", phone: "" },
      vehicle: { brand: "Honda", model: "XR" },
      idempotencyKey: "invalid-contact",
      now,
    });

    expect(result.accepted).toBe(false);
    expect(result.accepted ? null : result.reason).toBe("VALIDATION_FAILED");
    expect(repository.createdAppointments).toHaveLength(0);
  });

  it("rejects a submitted slot that no longer has capacity", async () => {
    const repository = new InMemoryBookingRepository({
      services: [service({ id: "oil", durationMinutes: 30 })],
      appointments: [
        appointment({ startAt: "2026-07-06T09:00:00-03:00", endAt: "2026-07-06T09:30:00-03:00" }),
        appointment({ startAt: "2026-07-06T09:00:00-03:00", endAt: "2026-07-06T09:30:00-03:00" }),
      ],
    });

    const result = await createPublicBooking(repository, validBooking({ serviceId: "oil", startTime: "09:00" }));

    expect(result).toEqual({ accepted: false, reason: "SLOT_UNAVAILABLE", message: "Elegí otro horario disponible." });
    expect(repository.createdAppointments).toHaveLength(0);
  });

  it("creates an automatically confirmed appointment without a cancellation token when policy disables cancellation", async () => {
    const repository = new InMemoryBookingRepository({
      settings: { ...workshopSeedConfig.settings, confirmationMode: "AUTOMATIC", depositRequired: false },
      services: [service({ id: "oil", durationMinutes: 30 })],
    });

    const result = await createPublicBooking(repository, validBooking({ serviceId: "oil", startTime: "09:00" }));

    expect(result).toMatchObject({
      accepted: true,
      message: "Tu turno quedó confirmado automáticamente.",
      appointment: { serviceName: "Service Esencial", status: "CONFIRMED", publicCode: expect.stringMatching(/^[A-HJ-NP-Z2-9]{10}$/u) },
    });
    expect(result.accepted ? result.cancellationToken : "unexpected").toBeNull();
    expect(repository.createdAppointments).toHaveLength(1);
  });

  it("persists a requested duration longer than the service default", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 60 })] });

    const result = await createPublicBooking(repository, validBooking({
      serviceId: "oil",
      durationMinutes: 90,
      startTime: "09:00",
    }));

    expect(result).toMatchObject({ accepted: true });
    expect(repository.createdAppointments[0]?.endAt.getTime() - repository.createdAppointments[0]?.startAt.getTime())
      .toBe(90 * 60_000);
  });

  it("rejects a requested duration shorter than the service default", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 60 })] });

    const result = await createPublicBooking(repository, validBooking({ durationMinutes: 30 }));

    expect(result).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(repository.createdAppointments).toHaveLength(0);
  });

  it("creates a pending appointment with a cancellation token when manual confirmation and cancellation are enabled", async () => {
    const repository = new InMemoryBookingRepository({
      settings: { ...workshopSeedConfig.settings, confirmationMode: "MANUAL", cancellationEnabled: true },
      services: [service({ id: "oil", durationMinutes: 30 })],
    });

    const result = await createPublicBooking(repository, validBooking({ serviceId: "oil", startTime: "09:00" }));

    expect(result).toMatchObject({
      accepted: true,
      message: "Recibimos tu pedido de turno y queda pendiente de confirmación del taller.",
      appointment: { serviceName: "Service Esencial", status: "PENDING_CONFIRMATION" },
    });
    expect(result.accepted ? result.cancellationToken : "").toHaveLength(32);
  });

  it("returns the existing appointment for a repeated idempotency key", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil" })] });

    const first = await createPublicBooking(repository, validBooking({ idempotencyKey: "repeat-key" }));
    const second = await createPublicBooking(repository, validBooking({ idempotencyKey: "repeat-key" }));

    expect(first).toMatchObject({ accepted: true, appointment: { idempotencyKey: "repeat-key" } });
    expect(second).toMatchObject({
      accepted: true,
      message: "Este pedido de turno ya fue recibido. Usá el mensaje original para acceder al enlace de cancelación.",
      appointment: { idempotencyKey: "repeat-key" },
    });
    expect(second.accepted ? second.cancellationToken : "unexpected").toBeNull();
    expect(second.accepted && first.accepted ? second.appointment.publicCode : "unexpected").toBe(
      first.accepted ? first.appointment.publicCode : "unexpected",
    );
    expect(repository.createdAppointments).toHaveLength(1);
  });

  it("does not expose an unusable cancellation token when a repeated idempotency lookup cannot recover the original token", async () => {
    const repository = new InMemoryBookingRepository({
      services: [service({ id: "oil" })],
      appointments: [appointment({ id: "appt_repeat", idempotencyKey: "repeat-key", cancellationToken: null })],
    });

    const result = await createPublicBooking(repository, validBooking({ idempotencyKey: "repeat-key" }));

    expect(result).toMatchObject({
      accepted: true,
      message: "Este pedido de turno ya fue recibido. Usá el mensaje original para acceder al enlace de cancelación.",
      appointment: { id: "appt_repeat", idempotencyKey: "repeat-key" },
    });
    expect(result.accepted ? result.cancellationToken : "unexpected").toBeNull();
    expect(repository.createdAppointments).toHaveLength(0);
  });

  it("queues the confirmation email with the appointment instead of sending it during the request", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 30 })] });

    const result = await createPublicBooking(repository, validBooking({ serviceId: "oil", startTime: "09:00" }));

    expect(result).toMatchObject({ accepted: true, appointment: { status: "PENDING_CONFIRMATION" } });
    expect(repository.queuedEmails).toEqual([
      expect.objectContaining({ appointmentId: "appt_1", event: "PUBLIC_BOOKING_CREATED", recipient: "ada@example.com" }),
    ]);
  });

  it("queues nothing when the customer leaves no email or the request repeats", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 30 })] });
    const withoutEmail = validBooking({ serviceId: "oil", startTime: "09:00" });

    await createPublicBooking(repository, { ...withoutEmail, customer: { ...withoutEmail.customer, email: undefined } });
    await createPublicBooking(repository, { ...withoutEmail, customer: { ...withoutEmail.customer, email: undefined } });

    expect(repository.createdAppointments).toHaveLength(1);
    expect(repository.queuedEmails).toEqual([]);
  });
});

describe("cancelPublicAppointment", () => {
  it("cancels an eligible appointment when policy and token are valid", async () => {
    const repository = new InMemoryBookingRepository({
      settings: { ...workshopSeedConfig.settings, cancellationEnabled: true },
      services: [service({ id: "oil" })],
      appointments: [appointment({ id: "appt_1", cancellationToken: "valid-token", startAt: "2026-07-06T09:00:00-03:00" })],
    });

    const result = await cancelPublicAppointment(repository, { appointmentId: "appt_1", token: "valid-token", now });

    expect(result).toEqual({ accepted: true, message: "Tu turno fue cancelado.", reschedulingAvailable: false });
    expect(repository.appointments[0]?.status).toBe("CANCELLED");
  });

  it("rejects a cancellation when the appointment changed status after it was read", async () => {
    const repository = new InMemoryBookingRepository({
      settings: { ...workshopSeedConfig.settings, cancellationEnabled: true },
      services: [service({ id: "oil" })],
      appointments: [appointment({ id: "appt_1", cancellationToken: "valid-token", startAt: "2026-07-06T09:00:00-03:00" })],
    });
    const find = repository.findCancellableAppointment.bind(repository);
    repository.findCancellableAppointment = async (appointmentId, token) => {
      const found = await find(appointmentId, token);
      const snapshot = found && { ...found };
      // Another request confirms the appointment between the read and the write.
      repository.appointments[0]!.status = "CONFIRMED";
      return snapshot;
    };

    const result = await cancelPublicAppointment(repository, { appointmentId: "appt_1", token: "valid-token", now });

    expect(result).toMatchObject({ accepted: false, reason: "CANCELLATION_UNAVAILABLE" });
    expect(repository.appointments[0]?.status).toBe("CONFIRMED");
  });

  it("rejects cancellation with an invalid token or disabled policy", async () => {
    const repository = new InMemoryBookingRepository({
      settings: { ...workshopSeedConfig.settings, cancellationEnabled: false },
      services: [service({ id: "oil" })],
      appointments: [appointment({ id: "appt_1", cancellationToken: "valid-token" })],
    });

    await expect(cancelPublicAppointment(repository, { appointmentId: "appt_1", token: "wrong", now })).resolves.toEqual({
      accepted: false,
      reason: "CANCELLATION_UNAVAILABLE",
      message: "Este turno no se puede cancelar online.",
    });
  });
});

describe("getPublicAppointmentStatus", () => {
  it("normalizes a code and returns only the public appointment summary", async () => {
    const repository = new InMemoryBookingRepository({
      appointments: [appointment({ publicCode: "ABCD234567", status: "CONFIRMED" })],
    });

    const result = await getPublicAppointmentStatus(repository, { code: "  abcd234567  " });

    expect(result).toEqual({
      accepted: true,
      appointment: {
        publicCode: "ABCD234567",
        serviceName: "Service Esencial",
        serviceDurationMinutes: 30,
        startAt: new Date("2026-07-06T09:00:00-03:00"),
        endAt: new Date("2026-07-06T09:30:00-03:00"),
        status: "CONFIRMED",
      },
    });
    expect(result.accepted ? Object.keys(result.appointment).sort() : []).toEqual(
      ["endAt", "publicCode", "serviceDurationMinutes", "serviceName", "startAt", "status"].sort(),
    );
  });

  it("includes the public code in the booking confirmation email", async () => {
    const repository = new InMemoryBookingRepository({ services: [service({ id: "oil", durationMinutes: 30 })] });

    const result = await createPublicBooking(repository, validBooking());

    expect(result.accepted).toBe(true);
    expect(repository.queuedEmails[0]?.text).toContain(result.accepted ? result.appointment.publicCode : "unexpected");
  });

  it("returns the same generic result for malformed and unknown codes", async () => {
    const repository = new InMemoryBookingRepository({ appointments: [] });

    const malformed = await getPublicAppointmentStatus(repository, { code: "bad" });
    const unknown = await getPublicAppointmentStatus(repository, { code: "ABCD234567" });

    expect(malformed).toEqual({ accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No encontramos un turno con ese código." });
    expect(unknown).toEqual(malformed);
  });
});

function validBooking(overrides: Partial<Parameters<typeof createPublicBooking>[1]> = {}) {
  return {
    serviceId: "oil",
    date: monday,
    startTime: "09:00",
    customer: { fullName: "Ada Lovelace", phone: "+5491112345678", email: "ada@example.com" },
    vehicle: { brand: "Honda", model: "XR", licensePlate: "ABC123" },
    idempotencyKey: "booking-key",
    now,
    ...overrides,
  };
}

function service(overrides: Partial<PublicServiceRecord> = {}): PublicServiceRecord {
  return {
    id: "oil",
    name: "Service Esencial",
    description: null,
    durationMinutes: 30,
    isActive: true,
    displayOrder: 1,
    ...overrides,
  };
}

function appointment(
  overrides: Omit<Partial<PublicAppointmentRecord>, "startAt" | "endAt"> & { startAt?: string; endAt?: string } = {},
): PublicAppointmentRecord {
  return {
    id: overrides.id ?? "appt",
    serviceId: "oil",
    serviceName: "Service Esencial",
    serviceDurationMinutes: overrides.serviceDurationMinutes ?? 30,
    startAt: new Date(overrides.startAt ?? "2026-07-06T09:00:00-03:00"),
    endAt: new Date(overrides.endAt ?? "2026-07-06T09:30:00-03:00"),
    status: overrides.status ?? "PENDING_CONFIRMATION",
    publicCode: overrides.publicCode ?? "TEST234567",
    idempotencyKey: overrides.idempotencyKey ?? "existing-key",
    cancellationToken: overrides.cancellationToken === undefined ? "token" : overrides.cancellationToken,
  };
}

class InMemoryBookingRepository implements BookingRepository {
  settings;
  schedules;
  breaks;
  exceptions;
  services;
  appointments;
  createdAppointments: PublicAppointmentRecord[] = [];
  queuedEmails: Array<EmailNotificationDraft & { appointmentId: string }> = [];

  constructor(input: {
    settings?: typeof workshopSeedConfig.settings;
    services?: PublicServiceRecord[];
    appointments?: PublicAppointmentRecord[];
    exceptions?: ScheduleDateException[];
  }) {
    this.settings = input.settings ?? workshopSeedConfig.settings;
    this.schedules = workshopSeedConfig.schedules;
    this.breaks = workshopSeedConfig.breaks;
    this.exceptions = input.exceptions ?? [];
    this.services = input.services ?? [];
    this.appointments = input.appointments ?? [];
  }

  async getBookingContext() {
    return { settings: this.settings, schedules: this.schedules, breaks: this.breaks, exceptions: this.exceptions };
  }

  async listActiveServices() {
    return this.services.filter((item) => item.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async findActiveService(serviceId: string) {
    return this.services.find((item) => item.id === serviceId && item.isActive) ?? null;
  }

  async findAppointmentsForDate() {
    return this.appointments;
  }

  async listActiveVehicleTypes() {
    return [{ id: "type-moto", name: "Moto" }];
  }

  async withBookingTransaction<T>(operation: (repository: BookingRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return this.appointments.find((item) => item.idempotencyKey === idempotencyKey) ?? null;
  }

  async findByPublicCode(publicCode: string) {
    return this.appointments.find((item) => item.publicCode === publicCode) ?? null;
  }

  async createAppointment(input: Parameters<BookingRepository["createAppointment"]>[0]) {
    const created = appointment({
      id: `appt_${this.appointments.length + 1}`,
      serviceId: input.service.id,
      serviceName: input.service.name,
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
      idempotencyKey: input.idempotencyKey,
      cancellationToken: input.cancellationToken,
      status: input.status,
      publicCode: (input as typeof input & { publicCode?: string }).publicCode ?? "",
    });
    this.appointments.push(created);
    this.createdAppointments.push(created);
    if (input.notification) this.queuedEmails.push({ appointmentId: created.id, ...input.notification });
    return created;
  }

  async findCancellableAppointment(appointmentId: string, token: string) {
    return this.appointments.find((item) => item.id === appointmentId && item.cancellationToken === token) ?? null;
  }

  async cancelAppointment(appointmentId: string, fromStatus: AppointmentStatus) {
    const found = this.appointments.find((item) => item.id === appointmentId);
    if (!found) throw new Error("Appointment not found");
    if (found.status !== fromStatus) return false;
    found.status = "CANCELLED";
    return true;
  }
}


