import type { PrismaClient } from "@prisma/client";
import type { MercadoPagoEnv } from "@/src/lib/env";
import { MercadoPagoAdapter, expectedPaymentLiveMode } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository, expireOverdueDepositReservations } from "@/src/modules/payments/prisma-repository";
import {
  processMercadoPagoPayment,
  reconcileDepositAttempt,
  type DepositReconciler,
} from "@/src/modules/payments/service";
import { getWorkshopPaymentEnv } from "@/src/modules/settings/runtime-settings";

export function createDepositReconciler(prisma: PrismaClient, env: MercadoPagoEnv): DepositReconciler {
  const repository = new PrismaDepositPaymentRepository(prisma);
  const port = new MercadoPagoAdapter(env);
  return async (externalReference) => {
    await reconcileDepositAttempt(repository, port, { externalReference, expectedLiveMode: expectedPaymentLiveMode(env) });
  };
}

/** The reconciler for the configured Mercado Pago account, or undefined while payments are not set up. */
export async function getDepositReconciler(prisma: PrismaClient): Promise<DepositReconciler | undefined> {
  const env = await getWorkshopPaymentEnv(prisma);
  return env ? createDepositReconciler(prisma, env) : undefined;
}

let sweepInFlight: Promise<number> | null = null;

/**
 * Expires overdue reservations, first asking Mercado Pago about each one when payments are configured.
 * Callers in the same instance share one running sweep instead of stacking provider calls; sweeps in
 * other instances stay safe because every release re-checks the appointment under a row lock.
 */
export function settleOverdueDeposits(prisma: PrismaClient, now = new Date()): Promise<number> {
  sweepInFlight ??= expireOverdueDepositReservations(prisma, now, { loadReconciler: () => getDepositReconciler(prisma) })
    .finally(() => {
      sweepInFlight = null;
    });
  return sweepInFlight;
}

/**
 * Applies the payment named in a Checkout Pro return URL. The id comes from the browser, but the data
 * is read from Mercado Pago and must match a stored attempt, so a forged id changes nothing.
 */
export async function reconcileReturnedPayment(prisma: PrismaClient, paymentId: string): Promise<void> {
  if (!/^\d{1,30}$/u.test(paymentId)) return;
  const env = await getWorkshopPaymentEnv(prisma);
  if (!env) return;
  await processMercadoPagoPayment(new PrismaDepositPaymentRepository(prisma), new MercadoPagoAdapter(env), {
    paymentId,
    expectedLiveMode: expectedPaymentLiveMode(env),
  });
}
