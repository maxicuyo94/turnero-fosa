import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { PrismaAppointmentRepository } from "@/src/modules/appointments/prisma-repository";
import { updateAppointmentDetails } from "@/src/modules/appointments/detail-edit";
import { rescheduleInternalAppointment, updateInternalAppointmentStatus } from "@/src/modules/appointments/operations";

const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });

describe("Prisma internal operations integration", () => {
  beforeEach(async () => {
    await deleteInternalTestData();
  });

  afterAll(async () => {
    await deleteInternalTestData();
    await prisma.$disconnect();
  });

  it("saves contact and notes with attributed field history and rejects a stale edit", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-details");
    const actor = await prisma.user.create({ data: { email: `internal-${randomUUID()}@example.com`, name: "Editor" } });
    const before = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { customer: true } });
    const input = {
      appointmentId,
      expectedCustomerUpdatedAt: before.customer.updatedAt.toISOString(),
      expectedAppointmentUpdatedAt: before.updatedAt.toISOString(),
      expectedCustomerDetailVersion: before.customer.detailVersion,
      expectedAppointmentDetailVersion: before.detailVersion,
      fullName: "Cliente corregido",
      phone: `+54911${Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0")}`,
      email: "corregido@example.com",
      notes: "Revisar frenos delanteros",
      changedById: actor.id,
    };

    expect(await updateAppointmentDetails(prisma, input)).toEqual({ status: "UPDATED" });
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { customer: true, detailChanges: true } });
    const history = await prisma.appointmentDetailChange.findMany({ where: { customerId: stored.customerId } });
    expect(stored.customer).toMatchObject({ fullName: input.fullName, phone: input.phone, email: input.email, detailVersion: 1 });
    expect(stored).toMatchObject({ notes: input.notes, detailVersion: 1 });
    expect(history).toHaveLength(4);
    expect(history.map((change) => change.field).sort()).toEqual(["APPOINTMENT_NOTES", "CUSTOMER_EMAIL", "CUSTOMER_NAME", "CUSTOMER_PHONE"]);
    expect(history.every((change) => change.changedById === actor.id && change.appointmentId === appointmentId)).toBe(true);
    expect(await updateAppointmentDetails(prisma, { ...input, notes: "Una edición vieja" })).toEqual({ status: "STALE" });
    expect(await prisma.appointmentDetailChange.count({ where: { customerId: stored.customerId } })).toBe(4);
  });

  it("accepts only one of two simultaneous detail edits", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-details-race");
    const actor = await prisma.user.create({ data: { email: `internal-${randomUUID()}@example.com`, name: "Editor" } });
    const before = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { customer: true } });
    const input = {
      appointmentId,
      expectedCustomerUpdatedAt: before.customer.updatedAt.toISOString(),
      expectedAppointmentUpdatedAt: before.updatedAt.toISOString(),
      expectedCustomerDetailVersion: before.customer.detailVersion,
      expectedAppointmentDetailVersion: before.detailVersion,
      fullName: before.customer.fullName,
      phone: before.customer.phone,
      email: before.customer.email ?? "",
      changedById: actor.id,
    };
    const results = await Promise.all([
      updateAppointmentDetails(prisma, { ...input, notes: "Primera nota" }),
      updateAppointmentDetails(prisma, { ...input, notes: "Segunda nota" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["STALE", "UPDATED"]);
    expect(await prisma.appointmentDetailChange.count({ where: { appointmentId } })).toBe(1);
  });

  it("does not assign one phone to two customers during simultaneous corrections", async () => {
    const firstId = await createInternalTestAppointment("it-internal-phone-race-1");
    const secondId = await createInternalTestAppointment("it-internal-phone-race-2");
    const actor = await prisma.user.create({ data: { email: `internal-${randomUUID()}@example.com`, name: "Editor" } });
    const appointments = await prisma.appointment.findMany({ where: { id: { in: [firstId, secondId] } }, include: { customer: true } });
    const targetPhone = `+54911${Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0")}`;
    const results = await Promise.all(appointments.map((appointment) => updateAppointmentDetails(prisma, {
      appointmentId: appointment.id,
      expectedCustomerUpdatedAt: appointment.customer.updatedAt.toISOString(),
      expectedAppointmentUpdatedAt: appointment.updatedAt.toISOString(),
      expectedCustomerDetailVersion: appointment.customer.detailVersion,
      expectedAppointmentDetailVersion: appointment.detailVersion,
      fullName: appointment.customer.fullName,
      phone: targetPhone,
      email: appointment.customer.email ?? "",
      notes: appointment.notes ?? "",
      changedById: actor.id,
    })));
    expect(results.map((result) => result.status).sort()).toEqual(["PHONE_IN_USE", "UPDATED"]);
    expect(await prisma.customer.count({ where: { phoneNormalized: targetPhone.replace(/\D/gu, "") } })).toBe(1);
  });

  it("updates appointment status and stores nullable system attribution in PostgreSQL status history", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-system");

    const result = await updateInternalAppointmentStatus(new PrismaAppointmentRepository(prisma), {
      appointmentId,
      nextStatus: "CONFIRMED",
      changedById: null,
      note: "Confirmed by internal workflow without a user id.",
    });

    const history = await prisma.appointmentStatusHistory.findMany({ where: { appointmentId }, orderBy: { changedAt: "asc" } });
    expect(result).toEqual({ accepted: true, appointment: expect.objectContaining({ id: appointmentId, status: "CONFIRMED" }) });
    expect(history).toEqual([
      expect.objectContaining({
        appointmentId,
        fromStatus: "PENDING_CONFIRMATION",
        toStatus: "CONFIRMED",
        changedById: null,
        note: "Confirmed by internal workflow without a user id.",
      }),
    ]);
  });

  it("updates appointment status and stores the authenticated user id when available", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-user");
    const user = await prisma.user.create({ data: { email: `internal-${randomUUID()}@example.com`, name: "Internal Tester" } });

    const result = await updateInternalAppointmentStatus(new PrismaAppointmentRepository(prisma), {
      appointmentId,
      nextStatus: "CONFIRMED",
      changedById: user.id,
    });

    const history = await prisma.appointmentStatusHistory.findFirstOrThrow({ where: { appointmentId } });
    expect(result).toEqual({ accepted: true, appointment: expect.objectContaining({ id: appointmentId, status: "CONFIRMED" }) });
    expect(history).toEqual(expect.objectContaining({ appointmentId, fromStatus: "PENDING_CONFIRMATION", toStatus: "CONFIRMED", changedById: user.id }));
  });

  it("lets only one of two concurrent status changes apply and records a single history row", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-status-race");

    const results = await Promise.all([
      updateInternalAppointmentStatus(new PrismaAppointmentRepository(prisma), { appointmentId, nextStatus: "CONFIRMED", changedById: null }),
      updateInternalAppointmentStatus(new PrismaAppointmentRepository(prisma), { appointmentId, nextStatus: "CANCELLED", changedById: null }),
    ]);

    expect(results.filter((result) => result.accepted)).toHaveLength(1);
    expect(results.filter((result) => !result.accepted).map((result) => result.accepted ? "" : result.reason)).toEqual(["INVALID_TRANSITION"]);
    const history = await prisma.appointmentStatusHistory.findMany({ where: { appointmentId } });
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBe("PENDING_CONFIRMATION");
  });

  it("atomically reschedules an appointment and records its interval history", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-reschedule");

    const result = await rescheduleInternalAppointment(new PrismaAppointmentRepository(prisma), {
      appointmentId,
      date: "2026-07-22",
      startTime: "10:00",
      durationMinutes: 60,
      changedById: null,
      reason: "Requested during integration test.",
    });

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: { intervalHistory: true },
    });
    expect(result).toMatchObject({
      accepted: true,
      appointment: {
        startAt: new Date("2026-07-22T10:00:00-03:00"),
        endAt: new Date("2026-07-22T11:00:00-03:00"),
      },
    });
    expect(stored.intervalHistory).toEqual([
      expect.objectContaining({
        previousStartAt: new Date("2026-07-21T09:00:00-03:00"),
        previousEndAt: new Date("2026-07-21T09:30:00-03:00"),
        newStartAt: new Date("2026-07-22T10:00:00-03:00"),
        newEndAt: new Date("2026-07-22T11:00:00-03:00"),
        reason: "Requested during integration test.",
      }),
    ]);
  });

  it("rolls back both the interval and history when capacity rejects the update", async () => {
    const candidateId = await createInternalTestAppointment("it-internal-rollback-candidate");
    const firstBlockerId = await createInternalTestAppointment("it-internal-rollback-blocker-1");
    const secondBlockerId = await createInternalTestAppointment("it-internal-rollback-blocker-2");
    await prisma.appointment.updateMany({
      where: { id: { in: [firstBlockerId, secondBlockerId] } },
      data: {
        startAt: new Date("2026-07-22T10:00:00-03:00"),
        endAt: new Date("2026-07-22T11:00:00-03:00"),
      },
    });

    const result = await rescheduleInternalAppointment(new PrismaAppointmentRepository(prisma), {
      appointmentId: candidateId,
      date: "2026-07-22",
      startTime: "10:00",
      durationMinutes: 60,
      changedById: null,
    });
    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: candidateId },
      include: { intervalHistory: true },
    });

    expect(result).toMatchObject({ accepted: false, reason: "CAPACITY_EXHAUSTED" });
    expect(stored.startAt).toEqual(new Date("2026-07-21T09:00:00-03:00"));
    expect(stored.endAt).toEqual(new Date("2026-07-21T09:30:00-03:00"));
    expect(stored.intervalHistory).toEqual([]);
  });

  it("allows at most one concurrent edit to claim the final capacity", async () => {
    const blockerId = await createInternalTestAppointment("it-internal-concurrent-blocker");
    const firstId = await createInternalTestAppointment("it-internal-concurrent-first");
    const secondId = await createInternalTestAppointment("it-internal-concurrent-second");
    await prisma.appointment.update({
      where: { id: blockerId },
      data: {
        startAt: new Date("2026-07-22T10:00:00-03:00"),
        endAt: new Date("2026-07-22T11:00:00-03:00"),
      },
    });

    const [first, second] = await Promise.all([
      rescheduleInternalAppointment(new PrismaAppointmentRepository(prisma), {
        appointmentId: firstId,
        date: "2026-07-22",
        startTime: "10:00",
        durationMinutes: 60,
        changedById: null,
      }),
      rescheduleInternalAppointment(new PrismaAppointmentRepository(prisma), {
        appointmentId: secondId,
        date: "2026-07-22",
        startTime: "10:00",
        durationMinutes: 60,
        changedById: null,
      }),
    ]);
    const stored = await prisma.appointment.findMany({
      where: { id: { in: [firstId, secondId] } },
      include: { intervalHistory: true },
    });

    expect([first, second].filter((result) => result.accepted)).toHaveLength(1);
    expect([first, second].filter((result) => !result.accepted && result.reason === "CAPACITY_EXHAUSTED")).toHaveLength(1);
    expect(stored.flatMap((appointment) => appointment.intervalHistory)).toHaveLength(1);
  });
});

async function createInternalTestAppointment(idempotencyKey: string): Promise<string> {
  const service = await prisma.service.findFirst({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
  if (!service) throw new Error("Seed an active service before running integration tests.");

  const customer = await prisma.customer.create({
    data: {
      fullName: `Internal Integration Rider ${randomUUID()}`,
      phone: `+54911${Math.floor(Math.random() * 1_000_000_000)}`,
      email: `${idempotencyKey}@example.com`,
      vehicles: { create: { vehicleTypeId: await activeVehicleTypeId(), brand: "Honda", model: "XR150", licensePlate: idempotencyKey.toUpperCase() } },
    },
    include: { vehicles: true },
  });

  const appointment = await prisma.appointment.create({
    data: {
      serviceId: service.id,
      customerId: customer.id,
      vehicleId: customer.vehicles[0].id,
      startAt: new Date(`2026-07-21T09:00:00-03:00`),
      endAt: new Date(`2026-07-21T09:30:00-03:00`),
      idempotencyKey,
      status: "PENDING_CONFIRMATION",
    },
  });

  return appointment.id;
}

async function deleteInternalTestData() {
  const appointments = await prisma.appointment.findMany({
    where: { idempotencyKey: { startsWith: "it-internal-" } },
    select: { id: true, vehicleId: true, customerId: true },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.id) } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.vehicleId) } } });
  await prisma.customer.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.customerId) } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "internal-" } } });
}

async function activeVehicleTypeId() {
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return vehicleType.id;
}
