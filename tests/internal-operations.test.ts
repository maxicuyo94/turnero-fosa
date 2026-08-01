import { describe, expect, it } from "vitest";
import {
  getInternalAgenda,
  updateInternalAppointmentDuration,
  updateInternalAppointmentStatus,
  type InternalAppointmentRecord,
  type InternalOperationsRepository,
} from "@/src/modules/internal/operations";
import type {
  EmailNotificationMessage,
  NotificationLogRepository,
  NotificationPort,
} from "@/src/modules/notifications/service";

const today = "2026-07-06";

describe("internal daily agenda", () => {
  it("lists appointments for the selected date in start time order", async () => {
    const repository = new InMemoryInternalRepository([
      appointment({ id: "late", startAt: "2026-07-06T15:00:00-03:00" }),
      appointment({ id: "other-day", startAt: "2026-07-07T09:00:00-03:00" }),
      appointment({ id: "early", startAt: "2026-07-06T09:00:00-03:00" }),
    ]);

    const agenda = await getInternalAgenda(repository, { date: today });

    expect(agenda).toEqual({ date: today, appointments: [expect.objectContaining({ id: "early" }), expect.objectContaining({ id: "late" })] });
  });

  it("returns an explicit empty agenda when no appointments exist", async () => {
    const repository = new InMemoryInternalRepository([]);

    await expect(getInternalAgenda(repository, { date: today })).resolves.toEqual({ date: today, appointments: [] });
  });
});

describe("internal status transitions", () => {
  it("confirms a pending appointment and records status history", async () => {
    const repository = new InMemoryInternalRepository([appointment({ id: "appt_1", status: "PENDING_CONFIRMATION" })]);

    const result = await updateInternalAppointmentStatus(repository, {
      appointmentId: "appt_1",
      nextStatus: "CONFIRMED",
      changedById: "user_1",
      note: "Called customer.",
    });

    expect(result).toEqual({ accepted: true, appointment: expect.objectContaining({ id: "appt_1", status: "CONFIRMED" }) });
    expect(repository.statusHistory).toEqual([{ appointmentId: "appt_1", fromStatus: "PENDING_CONFIRMATION", toStatus: "CONFIRMED", changedById: "user_1", note: "Called customer." }]);
  });

  it("blocks unsupported transitions without changing the appointment", async () => {
    const repository = new InMemoryInternalRepository([appointment({ id: "appt_2", status: "COMPLETED" })]);

    const result = await updateInternalAppointmentStatus(repository, {
      appointmentId: "appt_2",
      nextStatus: "IN_PROGRESS",
      changedById: "user_1",
    });

    expect(result).toEqual({ accepted: false, reason: "INVALID_TRANSITION", message: "No se puede cambiar un turno de completado a en curso." });
    expect(repository.appointments[0]?.status).toBe("COMPLETED");
    expect(repository.statusHistory).toEqual([]);
  });

  it("sends and logs a provider-neutral notification after a status change", async () => {
    const repository = new InMemoryInternalRepository([appointment({ id: "appt_3", status: "CONFIRMED" })]);
    const port = new CollectingNotificationPort();
    const logRepository = new InMemoryNotificationLogRepository();

    const result = await updateInternalAppointmentStatus(
      repository,
      { appointmentId: "appt_3", nextStatus: "IN_PROGRESS", changedById: "user_1" },
      { port, logRepository },
    );

    expect(result).toMatchObject({ accepted: true, appointment: { status: "IN_PROGRESS" } });
    expect(port.messages).toEqual([
      expect.objectContaining({
        event: "APPOINTMENT_STATUS_CHANGED",
        appointmentId: "appt_3",
        recipient: "ada@example.com",
      }),
    ]);
    expect(logRepository.entries).toEqual([
      expect.objectContaining({ appointmentId: "appt_3", status: "SENT", providerId: "provider-message-id" }),
    ]);
  });
});

describe("internal appointment duration", () => {
  it("extends an active appointment while preserving its start time", async () => {
    const repository = new InMemoryInternalRepository([appointment({ id: "appt_extend", status: "CONFIRMED" })]);

    const result = await updateInternalAppointmentDuration(repository, {
      appointmentId: "appt_extend",
      durationMinutes: 90,
    });

    expect(result).toEqual({
      accepted: true,
      appointment: expect.objectContaining({
        id: "appt_extend",
        startAt: new Date("2026-07-06T09:00:00-03:00"),
        endAt: new Date("2026-07-06T10:30:00-03:00"),
      }),
    });
  });

  it("rejects shortening, terminal appointments, and extensions into the next local day", async () => {
    const repository = new InMemoryInternalRepository([
      appointment({ id: "long", endAt: "2026-07-06T10:30:00-03:00", status: "CONFIRMED" }),
      appointment({ id: "done", status: "COMPLETED" }),
      appointment({ id: "late", startAt: "2026-07-06T23:30:00-03:00", endAt: "2026-07-06T23:59:00-03:00", status: "IN_PROGRESS" }),
    ]);

    await expect(updateInternalAppointmentDuration(repository, { appointmentId: "long", durationMinutes: 60 }))
      .resolves.toMatchObject({ accepted: false, reason: "DURATION_NOT_EXTENDED" });
    await expect(updateInternalAppointmentDuration(repository, { appointmentId: "done", durationMinutes: 90 }))
      .resolves.toMatchObject({ accepted: false, reason: "TERMINAL_APPOINTMENT" });
    await expect(updateInternalAppointmentDuration(repository, { appointmentId: "late", durationMinutes: 90 }))
      .resolves.toMatchObject({ accepted: false, reason: "DAY_BOUNDARY_EXCEEDED" });
  });
});

function appointment(
  overrides: Omit<Partial<InternalAppointmentRecord>, "startAt" | "endAt"> & { startAt?: string | Date; endAt?: string | Date } = {},
): InternalAppointmentRecord {
  return {
    id: "appt",
    publicCode: "ABCD234567",
    serviceName: "Service Esencial",
    serviceDurationMinutes: 30,
    customerName: "Ada Lovelace",
    customerPhone: "+5491112345678",
    customerEmail: "ada@example.com",
    motorcycleLabel: "Honda XR ABC123",
    status: overrides.status ?? "PENDING_CONFIRMATION",
    notes: null,
    ...overrides,
    startAt: new Date(overrides.startAt ?? "2026-07-06T09:00:00-03:00"),
    endAt: new Date(overrides.endAt ?? "2026-07-06T09:30:00-03:00"),
  };
}

class CollectingNotificationPort implements NotificationPort {
  messages: EmailNotificationMessage[] = [];

  async sendEmail(message: EmailNotificationMessage) {
    this.messages.push(message);
    return { providerId: "provider-message-id" };
  }
}

class InMemoryNotificationLogRepository implements NotificationLogRepository {
  entries: Parameters<NotificationLogRepository["logEmail"]>[0][] = [];

  async logEmail(input: Parameters<NotificationLogRepository["logEmail"]>[0]) {
    this.entries.push(input);
  }
}

class InMemoryInternalRepository implements InternalOperationsRepository {
  statusHistory: Array<{ appointmentId: string; fromStatus: string; toStatus: string; changedById: string | null; note?: string }> = [];

  constructor(public appointments: InternalAppointmentRecord[]) {}

  async listAppointmentsForDate(date: string) {
    return this.appointments
      .filter((item) => item.startAt.toISOString().slice(0, 10) === date)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  async findAppointmentById(appointmentId: string) {
    return this.appointments.find((item) => item.id === appointmentId) ?? null;
  }

  async getSlotStepMinutes() {
    return 30;
  }

  async updateAppointmentEnd(input: { appointmentId: string; endAt: Date }) {
    const found = this.appointments.find((item) => item.id === input.appointmentId);
    if (!found) throw new Error("Appointment not found");
    found.endAt = input.endAt;
    return found;
  }

  async updateAppointmentStatus(input: Parameters<InternalOperationsRepository["updateAppointmentStatus"]>[0]) {
    const found = this.appointments.find((item) => item.id === input.appointmentId);
    if (!found) throw new Error("Appointment not found");
    const previous = found.status;
    found.status = input.nextStatus;
    this.statusHistory.push({
      appointmentId: input.appointmentId,
      fromStatus: previous,
      toStatus: input.nextStatus,
      changedById: input.changedById,
      note: input.note,
    });
    return found;
  }
}
