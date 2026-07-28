import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";
import { updateInternalAppointmentStatus } from "@/src/modules/internal/operations";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });

describe("Prisma internal operations integration", () => {
  beforeEach(async () => {
    await deleteInternalTestData();
  });

  afterAll(async () => {
    await deleteInternalTestData();
    await prisma.$disconnect();
  });

  it("updates appointment status and stores nullable system attribution in PostgreSQL status history", async () => {
    const appointmentId = await createInternalTestAppointment("it-internal-system");

    const result = await updateInternalAppointmentStatus(new PrismaInternalRepository(prisma), {
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

    const result = await updateInternalAppointmentStatus(new PrismaInternalRepository(prisma), {
      appointmentId,
      nextStatus: "CONFIRMED",
      changedById: user.id,
    });

    const history = await prisma.appointmentStatusHistory.findFirstOrThrow({ where: { appointmentId } });
    expect(result).toEqual({ accepted: true, appointment: expect.objectContaining({ id: appointmentId, status: "CONFIRMED" }) });
    expect(history).toEqual(expect.objectContaining({ appointmentId, fromStatus: "PENDING_CONFIRMATION", toStatus: "CONFIRMED", changedById: user.id }));
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
      motorcycles: { create: { brand: "Honda", model: "XR150", licensePlate: idempotencyKey.toUpperCase() } },
    },
    include: { motorcycles: true },
  });

  const appointment = await prisma.appointment.create({
    data: {
      serviceId: service.id,
      customerId: customer.id,
      motorcycleId: customer.motorcycles[0].id,
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
    select: { id: true, motorcycleId: true, customerId: true },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.id) } } });
  await prisma.motorcycle.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.motorcycleId) } } });
  await prisma.customer.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.customerId) } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "internal-" } } });
}
