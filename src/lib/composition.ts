import { after } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/src/lib/db";
import type { MercadoPagoEnv } from "@/src/lib/env";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { PrismaAppointmentRepository } from "@/src/modules/appointments/prisma-repository";
import { PrismaEmailDeliveryRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";
import { deliverPendingEmails, type EmailDeliverySummary, type NotificationPort } from "@/src/modules/notifications/service";
import { MercadoPagoAdapter, expectedPaymentLiveMode } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository, listPaidUnconfirmedDeposits } from "@/src/modules/payments/prisma-repository";
import { getDepositReconciler, reconcileReturnedPayment, settleOverdueDeposits } from "@/src/modules/payments/reconciliation";
import { processMercadoPagoPayment } from "@/src/modules/payments/service";
import { businessSettingsSchema } from "@/src/modules/settings/business-settings";
import { PrismaWorkshopSettingsRepository } from "@/src/modules/settings/prisma-repository";
import { getWorkshopNotificationEnv, getWorkshopPaymentEnv } from "@/src/modules/settings/runtime-settings";
import { findWorkshopSettingsRow } from "@/src/modules/settings/workshop-settings-row";
import { findStaffProfile, changeInternalPassword } from "@/src/modules/internal/account-service";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import {
  createInventoryProduct,
  importInventoryProducts,
  recordInventoryMovement,
  updateInventoryProduct,
} from "@/src/modules/shop/inventory-service";
import { findSimilarInventoryCodes, linkInventoryBarcode, resolveInventoryCode } from "@/src/modules/shop/inventory-code-service";
import {
  findInventoryProductDetail,
  getShopDashboard,
  listBarcodeLinkCandidates,
  listInventoryLocations,
  listInventoryProducts,
  listLabelProducts,
} from "@/src/modules/shop/inventory-queries";
import {
  applyStockCount,
  cancelStockCount,
  movementCounts,
  openStockCount,
  recordCountedQuantity,
  recountStockCountLine,
} from "@/src/modules/shop/stock-count-service";
import { findStockCountDetail, findStockCountProduct, listStockCounts } from "@/src/modules/shop/stock-count-queries";

/**
 * Composition root: the one place that wires modules to Prisma and to the outside providers.
 * Pages, actions and route handlers ask for what they need here instead of assembling adapters,
 * and never import the Prisma client themselves.
 */

type BoundToDb<Operations> = {
  [Name in keyof Operations]: Operations[Name] extends (prisma: PrismaClient, ...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : never;
};

/**
 * Modules without a repository port (the shop, the account) take the Prisma client as their first
 * argument; this hands them to the app with the client already applied.
 */
function bindDb<Operations extends Record<string, (prisma: PrismaClient, ...args: never[]) => unknown>>(
  operations: Operations,
): BoundToDb<Operations> {
  return Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [name, (...args: never[]) => operation(db, ...args)]),
  ) as BoundToDb<Operations>;
}

export const inventory = bindDb({
  createInventoryProduct,
  importInventoryProducts,
  updateInventoryProduct,
  recordInventoryMovement,
  linkInventoryBarcode,
  resolveInventoryCode,
  findSimilarInventoryCodes,
  getShopDashboard,
  listInventoryProducts,
  listInventoryLocations,
  findInventoryProductDetail,
  listLabelProducts,
  listBarcodeLinkCandidates,
});

export const stockCounts = bindDb({
  openStockCount,
  recordCountedQuantity,
  recountStockCountLine,
  applyStockCount,
  cancelStockCount,
  movementCounts,
  listStockCounts,
  findStockCountDetail,
  findStockCountProduct,
});

export const staffAccount = bindDb({ findStaffProfile, changeInternalPassword });

export function vehicleRepository(): PrismaVehicleRepository {
  return new PrismaVehicleRepository(db);
}

/** Public contact details shown in the footer; defaults while the workshop has not filled them. */
export async function workshopContactSettings() {
  return businessSettingsSchema.parse((await findWorkshopSettingsRow(db)) ?? {});
}

export function bookingRepository(): PrismaBookingRepository {
  return new PrismaBookingRepository(db, { beforeBooking: () => settleOverdueDeposits(db) });
}

export function appointmentRepository(): PrismaAppointmentRepository {
  return new PrismaAppointmentRepository(db);
}

export function workshopSettingsRepository(): PrismaWorkshopSettingsRepository {
  return new PrismaWorkshopSettingsRepository(db);
}

export function depositPaymentRepository(): PrismaDepositPaymentRepository {
  return new PrismaDepositPaymentRepository(db);
}

/** Mercado Pago checkout wiring, or null while payments are not configured. */
export async function depositCheckout(): Promise<{ repository: PrismaDepositPaymentRepository; port: MercadoPagoAdapter } | null> {
  const env = await getWorkshopPaymentEnv(db);
  return env ? { repository: depositPaymentRepository(), port: new MercadoPagoAdapter(env) } : null;
}

export const deposits = bindDb({ listPaidUnconfirmedDeposits, settleOverdueDeposits });

/** Applies a Mercado Pago payment notification; the payment itself is always re-read from the API. */
export function processMercadoPagoNotification(env: MercadoPagoEnv, paymentId: string): Promise<unknown> {
  return processMercadoPagoPayment(depositPaymentRepository(), new MercadoPagoAdapter(env), {
    paymentId,
    expectedLiveMode: expectedPaymentLiveMode(env),
  });
}

/**
 * Settles what the customer comes back with: the payment id when Mercado Pago sends one, otherwise
 * the checkout reference. Does nothing while payments are not configured.
 */
export async function reconcileReturnedDeposit(input: { paymentId?: string; reference: string }): Promise<void> {
  if (input.paymentId) {
    await reconcileReturnedPayment(db, input.paymentId);
  } else if (input.reference) {
    await (await getDepositReconciler(db))?.(input.reference);
  }
}

const deliveryDisabledPort: NotificationPort = {
  async sendEmail() {
    throw new Error("Email delivery is not configured.");
  },
};

/**
 * Delivers the due outbox emails. Without provider credentials the emails still go through the
 * retry policy, so they end up FAILED with a reason instead of waiting to be sent days later.
 */
export async function deliverOutboxEmails(): Promise<EmailDeliverySummary> {
  const env = await getWorkshopNotificationEnv(db);
  return deliverPendingEmails(new PrismaEmailDeliveryRepository(db), env ? new ResendNotificationPort(env) : deliveryDisabledPort);
}

/** Sends what the request just queued once the response is out, so the customer never waits on the provider. */
export function deliverOutboxEmailsAfterResponse(): void {
  after(async () => {
    try {
      await deliverOutboxEmails();
    } catch (error) {
      console.error("email outbox delivery failed; the next request or cron sweep retries it", error);
    }
  });
}

/**
 * Backstop for deployments without a scheduled deposit sweep: releases overdue holds once the
 * response is out, so viewing a page never waits on Mercado Pago.
 */
export function settleOverdueDepositsAfterResponse(): void {
  after(async () => {
    try {
      await settleOverdueDeposits(db);
    } catch (error) {
      console.error("deposit sweep failed; it runs again on the next request or cron call", error);
    }
  });
}
