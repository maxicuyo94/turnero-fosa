import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type AppointmentStatus, type DepositPaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import {
  PrismaDepositPaymentRepository,
  depositExpiredNote,
  expireOverdueDepositReservations,
  listPaidUnconfirmedDeposits,
} from "@/src/modules/payments/prisma-repository";
import { updateInternalAppointmentStatus } from "@/src/modules/appointments/operations";
import { PrismaAppointmentRepository } from "@/src/modules/appointments/prisma-repository";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { workshopDate } from "@/src/lib/workshop-date";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const repository = new PrismaDepositPaymentRepository(prisma);
const prefix = "it-payments-";
// Keep these fixtures ahead of real-time expiry scans in parallel booking tests.
const now = new Date(Date.now() + 86_400_000);
let serviceId: string;
let customerId: string;
let vehicleId: string;

describe("Prisma deposit reservations", () => {
  beforeAll(async () => {
    const workshop = await prisma.workshopSettings.create({ data: { ...workshopSeedConfig.settings } });
    const service = await prisma.service.create({
      data: { ...workshopSeedConfig.services[0], isActive: false, workshopSettingsId: workshop.id },
    });
    serviceId = service.id;
    const customer = await prisma.customer.create({
      data: { fullName: "Payment regression rider", phone: prefix, vehicles: { create: { vehicleTypeId: await activeVehicleTypeId(), brand: "Honda", model: "XR" } } },
      include: { vehicles: true },
    });
    customerId = customer.id;
    vehicleId = customer.vehicles[0].id;
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
  });

  afterAll(async () => {
    if (customerId) {
      await prisma.appointment.deleteMany({ where: { customerId } });
      // Vehicles outlive their owner's record now, so they are removed before the customer.
      await prisma.vehicle.deleteMany({ where: { customerId } });
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
    expect(await repository.createAttempt({ appointmentId: appointment.id, externalReference: randomUUID(), amountCents: 500_000, expiresAt: new Date(now.getTime() + 60_000), now })).toBeNull();
  });

  it("serializes retry creation against expiration", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    const [retry] = await Promise.all([
      repository.createAttempt({ appointmentId: appointment.id, externalReference: randomUUID(), amountCents: 500_000, expiresAt: new Date(now.getTime() + 60_000), now }),
      expireOverdueDepositReservations(prisma, now),
    ]);
    expect(await appointmentStatus(appointment.id)).toBe(retry ? "PENDING_CONFIRMATION" : "CANCELLED");
  });

  it("hands concurrent checkout starts the same attempt and keeps the first stored checkout", async () => {
    const appointment = await createAppointment();
    const start = () => repository.createAttempt({ appointmentId: appointment.id, externalReference: randomUUID(), amountCents: 500_000, expiresAt: new Date(now.getTime() + 60_000), now });
    const [first, second] = await Promise.all([start(), start()]);

    expect(first?.id).toBeDefined();
    expect(second?.id).toBe(first?.id);
    expect(await prisma.depositPaymentAttempt.count({ where: { appointmentId: appointment.id } })).toBe(1);

    const winner = await repository.markPreferenceCreated({ attemptId: first!.id, preferenceId: "pref-a", checkoutUrl: "https://mp/a" });
    const loser = await repository.markPreferenceCreated({ attemptId: first!.id, preferenceId: "pref-b", checkoutUrl: "https://mp/b" });
    await repository.markPreferenceFailed(first!.id, "late timeout");
    expect(winner.checkoutUrl).toBe("https://mp/a");
    expect(loser).toMatchObject({ checkoutUrl: "https://mp/a", preferenceId: "pref-a", status: "PENDING" });
  });

  it("confirms instead of cancelling when the expiry sweep finds an approved payment", async () => {
    const appointment = await createAppointment();
    const attempt = await createAttempt(appointment.id, "PENDING", -5);
    const reconciled: string[] = [];

    await expireOverdueDepositReservations(prisma, now, {
      reconcile: async (externalReference) => {
        reconciled.push(externalReference);
        await repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED"));
      },
    });

    expect(reconciled).toEqual([attempt.externalReference]);
    expect(await appointmentStatus(appointment.id)).toBe("CONFIRMED");
  });

  it("keeps the reservation for the next sweep when Mercado Pago cannot be reached", async () => {
    const appointment = await createAppointment();
    await createAttempt(appointment.id, "PENDING", -5);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expireOverdueDepositReservations(prisma, now, { reconcile: async () => { throw new Error("Mercado Pago API returned 503."); } });
    } finally {
      consoleError.mockRestore();
    }
    expect(await appointmentStatus(appointment.id)).toBe("PENDING_CONFIRMATION");

    await expireOverdueDepositReservations(prisma, now, { reconcile: async () => undefined });
    expect(await appointmentStatus(appointment.id)).toBe("CANCELLED");
  });

  it("reinstates an expired reservation when its deposit is approved late and the slot still fits", async () => {
    const appointment = await createAppointment(isolatedFutureSlot());
    const attempt = await createAttempt(appointment.id, "PENDING", -5);
    await expireOverdueDepositReservations(prisma, now);
    expect(await appointmentStatus(appointment.id)).toBe("CANCELLED");

    await repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED"));
    expect(await appointmentStatus(appointment.id)).toBe("CONFIRMED");
    expect(await lastHistoryNote(appointment.id)).toMatch(/reinstated/u);
    expect((await listPaidUnconfirmedDeposits(prisma)).some((item) => item.publicCode === appointment.publicCode)).toBe(false);
  });

  it("keeps a late-paid reservation cancelled and flags it when the slot is already full", async () => {
    const startAt = isolatedFutureSlot();
    const workshopSettingsId = (await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })).workshopSettingsId;
    const { capacity } = await prisma.workshopSettings.findUniqueOrThrow({ where: { id: workshopSettingsId } });
    await prisma.workshopSettings.update({ where: { id: workshopSettingsId }, data: { capacity: 1 } });
    try {
      const appointment = await createAppointment(startAt);
      const attempt = await createAttempt(appointment.id, "PENDING", -5);
      await expireOverdueDepositReservations(prisma, now);
      await createAppointment(startAt, "CONFIRMED");

      await repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED"));
      expect(await appointmentStatus(appointment.id)).toBe("CANCELLED");
      expect(await lastHistoryNote(appointment.id)).toBe(depositExpiredNote);
      const flagged = (await listPaidUnconfirmedDeposits(prisma)).find((item) => item.publicCode === appointment.publicCode);
      expect(flagged).toMatchObject({ amountCents: 500_000, customerName: "Payment regression rider" });
    } finally {
      await prisma.workshopSettings.update({ where: { id: workshopSettingsId }, data: { capacity } });
    }
  });

  it("does not undo a cancellation made by a person when a deposit is approved later", async () => {
    const appointment = await createAppointment(isolatedFutureSlot());
    const attempt = await createAttempt(appointment.id, "PENDING", 30);
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED", statusHistory: { create: { toStatus: "CANCELLED", note: "Cancelled by public token." } } },
    });

    await repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED"));
    expect(await appointmentStatus(appointment.id)).toBe("CANCELLED");
    expect((await listPaidUnconfirmedDeposits(prisma)).some((item) => item.publicCode === appointment.publicCode)).toBe(true);

    await repository.applyProviderPayment(paymentUpdate(attempt.id, "REFUNDED"));
    expect((await listPaidUnconfirmedDeposits(prisma)).some((item) => item.publicCode === appointment.publicCode)).toBe(false);
  });

  it("keeps a coherent status history when a deposit approval races an internal cancellation", async () => {
    for (let round = 0; round < 5; round += 1) {
      const appointment = await createAppointment(isolatedFutureSlot());
      const attempt = await createAttempt(appointment.id, "PENDING", 30);

      const [, cancellation] = await Promise.all([
        repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED")),
        updateInternalAppointmentStatus(new PrismaAppointmentRepository(prisma), { appointmentId: appointment.id, nextStatus: "CANCELLED", changedById: null }),
      ]);

      const history = await prisma.appointmentStatusHistory.findMany({ where: { appointmentId: appointment.id }, orderBy: { changedAt: "asc" } });
      // Every accepted change starts from the status the previous one left, whichever side won.
      history.forEach((row, index) => expect(row.fromStatus).toBe(index === 0 ? "PENDING_CONFIRMATION" : history[index - 1]!.toStatus));
      const finalStatus = await appointmentStatus(appointment.id);
      expect(history.at(-1)?.toStatus).toBe(finalStatus);
      expect(finalStatus).toBe(cancellation.accepted ? "CANCELLED" : "CONFIRMED");
      expect((await prisma.depositPaymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe("APPROVED");
    }
  });

  it("ignores stale notifications and mismatches once a deposit is approved", async () => {
    const appointment = await createAppointment();
    const attempt = await createAttempt(appointment.id, "PENDING", 30);
    await repository.applyProviderPayment(paymentUpdate(attempt.id, "APPROVED"));

    const stale = await repository.applyProviderPayment({ ...paymentUpdate(attempt.id, "REJECTED"), providerPaymentId: `rejected-${attempt.id}` });
    await repository.markAttemptError(attempt.id, "mismatch");
    const stored = await prisma.depositPaymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stale.status).toBe("APPROVED");
    expect(stored).toMatchObject({ status: "APPROVED", providerPaymentId: `provider-${attempt.id}` });
    expect(stored.lastNotificationAt).not.toBeNull();
    expect(await appointmentStatus(appointment.id)).toBe("CONFIRMED");
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

  it("lets read-only availability skip lapsed deposit holds without writing anything", async () => {
    const startAt = isolatedFutureSlot();
    const date = workshopDate(startAt);
    const lapsed = await createAppointment(startAt);
    // `now` runs a day ahead, so two days back is already past for the real clock the view uses.
    await createAttempt(lapsed.id, "PENDING", -2 * 24 * 60);
    const open = await createAppointment(new Date(startAt.getTime() + 60 * 60_000));
    await createAttempt(open.id, "PENDING", 60);
    const bookings = new PrismaBookingRepository(prisma);

    const view = await bookings.findAppointmentsForDate(date, { excludeLapsedDepositHolds: true });
    const authoritative = await bookings.findAppointmentsForDate(date);

    expect(view.map((item) => item.id)).toEqual([open.id]);
    expect(authoritative.map((item) => item.id).sort()).toEqual([lapsed.id, open.id].sort());
    expect(await appointmentStatus(lapsed.id)).toBe("PENDING_CONFIRMATION");
  });
});

function createAppointment(startAt = new Date("2026-09-10T12:00:00Z"), status: AppointmentStatus = "PENDING_CONFIRMATION") {
  return prisma.appointment.create({ data: {
    serviceId, customerId, vehicleId, status,
    idempotencyKey: `${prefix}${randomUUID()}`,
    startAt,
    endAt: new Date(startAt.getTime() + 60 * 60_000),
  } });
}

/** A future slot far from other suites' fixtures, so capacity checks only see this test's rows. */
function isolatedFutureSlot(): Date {
  const start = new Date("2031-01-01T12:00:00Z");
  start.setUTCDate(start.getUTCDate() + Math.floor(Math.random() * 3_000));
  return start;
}

async function lastHistoryNote(appointmentId: string) {
  return (await prisma.appointmentStatusHistory.findFirst({ where: { appointmentId }, orderBy: { changedAt: "desc" } }))?.note;
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

async function activeVehicleTypeId() {
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return vehicleType.id;
}
