import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type DepositPaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import { PrismaDepositPaymentRepository, expireOverdueDepositReservations } from "@/src/modules/payments/prisma-repository";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const repository = new PrismaDepositPaymentRepository(prisma);
const prefix = "it-payments-";
// Keep these fixtures ahead of real-time expiry scans in parallel booking tests.
const now = new Date(Date.now() + 86_400_000);
let serviceId: string;
let customerId: string;
let motorcycleId: string;

describe("Prisma deposit reservations", () => {
  beforeAll(async () => {
    const workshop = await prisma.workshopSettings.create({ data: { ...workshopSeedConfig.settings } });
    const service = await prisma.service.create({
      data: { ...workshopSeedConfig.services[0], isActive: false, workshopSettingsId: workshop.id },
    });
    serviceId = service.id;
    const customer = await prisma.customer.create({
      data: { fullName: "Payment regression rider", phone: prefix, motorcycles: { create: { brand: "Honda", model: "XR" } } },
      include: { motorcycles: true },
    });
    customerId = customer.id;
    motorcycleId = customer.motorcycles[0].id;
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
  });

  afterAll(async () => {
    if (customerId) {
      await prisma.appointment.deleteMany({ where: { customerId } });
      await prisma.customer.delete({ where: { id: customerId } });
    }
    if (serviceId) {
      const service = await prisma.service.delete({ where: { id: serviceId } });
      await prisma.workshopSettings.delete({ where: { id: service.workshopSettingsId } });
    }
    await prisma.$disconnect();
  });

  it("preserves a valid retry when an older attempt expires or is cancelled", async () => {
    const appointment = await createAppointment();
    const old = await createAttempt(appointment.id, "PENDING", -1);
    const retry = await createAttempt(appointment.id, "PENDING", 30);

    await expireOverdueDepositReservations(prisma, now);
    await repository.applyProviderPayment(paymentUpdate(old.id, "CANCELLED"));
    expect(await appointmentStatus(appointment.id)).toBe("PENDING_CONFIRMATION");

    await repository.applyProviderPayment(paymentUpdate(retry.id, "APPROVED"));
    await repository.applyProviderPayment(paymentUpdate(retry.id, "APPROVED"));
    expect(await appointmentStatus(appointment.id)).toBe("CONFIRMED");
    expect(await prisma.appointmentStatusHistory.count({ where: { appointmentId: appointment.id } })).toBe(1);
  });

  it.each(["ERROR", "REJECTED", "CANCELLED", "EXPIRED"] as const)("releases capacity after a %s attempt reaches its deadline", async (status) => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, status, 0);
    await expireOverdueDepositReservations(prisma, now);
    await expireOverdueDepositReservations(prisma, now);
    expect(await appointmentStatus(appointment.id)).toBe("CANCELLED");
    expect(await prisma.appointmentStatusHistory.count({ where: { appointmentId: appointment.id } })).toBe(1);
  });

  it("keeps the retry window open after a rejection", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "REJECTED", 5);
    await expireOverdueDepositReservations(prisma, now);
    expect(await appointmentStatus(appointment.id)).toBe("PENDING_CONFIRMATION");
  });

  it("does not expire an approved payment or its reservation", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    const approved = await createAttempt(appointment.id, "APPROVED", -5);
    await expireOverdueDepositReservations(prisma, now);
    expect(await appointmentStatus(appointment.id)).toBe("PENDING_CONFIRMATION");
    expect((await prisma.depositPaymentAttempt.findUniqueOrThrow({ where: { id: approved.id } })).status).toBe("APPROVED");
  });

  it("coordinates concurrent expiry and retry approval on the same appointment", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    const retry = await createAttempt(appointment.id, "PENDING", 30);
    await Promise.all([
      expireOverdueDepositReservations(prisma, now),
      repository.applyProviderPayment(paymentUpdate(retry.id, "APPROVED")),
    ]);
    expect(await appointmentStatus(appointment.id)).toBe("CONFIRMED");
    expect((await prisma.depositPaymentAttempt.findUniqueOrThrow({ where: { id: retry.id } })).status).toBe("APPROVED");
  });

  it("does not create a checkout after expiry has cancelled the reservation", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    await expireOverdueDepositReservations(prisma, now);
    expect(await repository.createAttempt({ appointmentId: appointment.id, externalReference: randomUUID(), amountCents: 500_000, expiresAt: new Date(now.getTime() + 60_000) })).toBeNull();
  });

  it("serializes retry creation against expiration", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    const [retry] = await Promise.all([
      repository.createAttempt({ appointmentId: appointment.id, externalReference: randomUUID(), amountCents: 500_000, expiresAt: new Date(now.getTime() + 60_000) }),
      expireOverdueDepositReservations(prisma, now),
    ]);
    expect(await appointmentStatus(appointment.id)).toBe(retry ? "PENDING_CONFIRMATION" : "CANCELLED");
  });

  it("only exposes a stored, unexpired checkout for the requested pending appointment", async () => {
    const appointment = await createAppointment();
    const attempt = await createAttempt(appointment.id, "PENDING", 30);
    await prisma.depositPaymentAttempt.update({ where: { id: attempt.id }, data: { checkoutUrl: "https://sandbox.mercadopago.com/checkout" } });
    expect(await repository.getPublicCheckout(appointment.publicCode, now)).toEqual({ checkoutUrl: "https://sandbox.mercadopago.com/checkout", amountCents: 500_000 });
    expect(await repository.getPublicCheckout("UNKNOWN", now)).toBeNull();
    expect(await repository.getPublicCheckout(appointment.publicCode, new Date(now.getTime() + 31 * 60_000))).toBeNull();
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
    expect(await repository.getPublicCheckout(appointment.publicCode, now)).toBeNull();
  });
});

function createAppointment() {
  return prisma.appointment.create({ data: {
    serviceId, customerId, motorcycleId,
    idempotencyKey: `${prefix}${randomUUID()}`,
    startAt: new Date("2026-09-10T12:00:00Z"),
    endAt: new Date("2026-09-10T13:00:00Z"),
  } });
}

function createAttempt(appointmentId: string, status: DepositPaymentStatus, minutes: number) {
  return prisma.depositPaymentAttempt.create({ data: {
    appointmentId, status, externalReference: randomUUID(), amountCents: 500_000,
    expiresAt: new Date(now.getTime() + minutes * 60_000),
  } });
}

async function appointmentStatus(id: string) {
  return (await prisma.appointment.findUniqueOrThrow({ where: { id } })).status;
}

function paymentUpdate(attemptId: string, status: DepositPaymentStatus) {
  return { attemptId, status, providerPaymentId: `provider-${attemptId}`, statusDetail: null, liveMode: false, approvedAt: status === "APPROVED" ? now : null };
}
