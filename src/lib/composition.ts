import { after } from "next/server";
import { db } from "@/src/lib/db";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { PrismaAppointmentRepository } from "@/src/modules/appointments/prisma-repository";
import { PrismaEmailDeliveryRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";
import { deliverPendingEmails, type EmailDeliverySummary, type NotificationPort } from "@/src/modules/notifications/service";
import { MercadoPagoAdapter } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { settleOverdueDeposits } from "@/src/modules/payments/reconciliation";
import { PrismaWorkshopSettingsRepository } from "@/src/modules/settings/prisma-repository";
import { getWorkshopNotificationEnv, getWorkshopPaymentEnv } from "@/src/modules/settings/runtime-settings";

/**
 * Composition root: the one place that wires modules to Prisma and to the outside providers.
 * Pages, actions and route handlers ask for what they need here instead of assembling adapters.
 */

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
