import { randomUUID } from "node:crypto";
import type { AppointmentStatus, DepositPaymentStatus } from "@prisma/client";

export type DepositPaymentAttemptRecord = {
  id: string;
  appointmentId: string;
  externalReference: string;
  preferenceId: string | null;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  amountCents: number;
  currency: string;
  status: DepositPaymentStatus;
  expiresAt: Date;
};

export type DepositPaymentRepository = {
  getDepositPolicy(): Promise<{ required: boolean; amountCents: number; expirationMinutes: number }>;
  findAppointmentForDeposit(appointmentId: string): Promise<{
    id: string;
    publicCode: string;
    serviceName: string;
    customerName: string;
    customerEmail: string | null;
    status: AppointmentStatus;
  } | null>;
  findReusableAttempt(appointmentId: string, now: Date): Promise<DepositPaymentAttemptRecord | null>;
  /**
   * Atomically returns the appointment's still-valid attempt or creates a new one, so concurrent
   * starts share a single checkout. Returns null when the appointment no longer accepts a deposit.
   */
  createAttempt(input: {
    appointmentId: string;
    externalReference: string;
    amountCents: number;
    expiresAt: Date;
    now: Date;
  }): Promise<DepositPaymentAttemptRecord | null>;
  /** Stores the checkout only if the attempt has none yet and returns the attempt as stored. */
  markPreferenceCreated(input: {
    attemptId: string;
    preferenceId: string;
    checkoutUrl: string;
  }): Promise<DepositPaymentAttemptRecord>;
  /** Marks a checkout that could not be created, unless a concurrent start already stored one. */
  markPreferenceFailed(attemptId: string, detail: string): Promise<void>;
  markAttemptError(attemptId: string, detail: string): Promise<void>;
  findByExternalReference(externalReference: string): Promise<DepositPaymentAttemptRecord | null>;
  applyProviderPayment(input: {
    attemptId: string;
    providerPaymentId: string;
    status: DepositPaymentStatus;
    statusDetail: string | null;
    liveMode: boolean;
    approvedAt: Date | null;
  }): Promise<DepositPaymentAttemptRecord>;
};

export type MercadoPagoPort = {
  createPreference(input: {
    externalReference: string;
    title: string;
    amountCents: number;
    payerEmail: string | null;
    expiresAt: Date;
  }): Promise<{ preferenceId: string; checkoutUrl: string }>;
  getPayment(paymentId: string): Promise<ProviderPayment>;
  /** Payments created for one external reference, newest first. */
  searchPayments(externalReference: string): Promise<ProviderPayment[]>;
};

export type ProviderPayment = {
  id: string;
  externalReference: string | null;
  amount: number;
  currency: string;
  status: string;
  statusDetail: string | null;
  liveMode: boolean;
  approvedAt: Date | null;
};

export async function initiateAppointmentDeposit(
  repository: DepositPaymentRepository,
  port: MercadoPagoPort,
  input: { appointmentId: string; now?: Date },
): Promise<
  | { accepted: true; required: false }
  | { accepted: true; required: true; checkoutUrl: string; reference: string; amountCents: number }
  | { accepted: false; reason: "APPOINTMENT_NOT_FOUND" | "APPOINTMENT_NOT_PAYABLE" | "PAYMENT_UNAVAILABLE"; message: string }
> {
  const now = input.now ?? new Date();
  const [policy, appointment] = await Promise.all([
    repository.getDepositPolicy(),
    repository.findAppointmentForDeposit(input.appointmentId),
  ]);
  if (!appointment) {
    return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No encontramos el turno para iniciar la seña." };
  }
  if (!policy.required) return { accepted: true, required: false };
  if (appointment.status !== "PENDING_CONFIRMATION") {
    return {
      accepted: false,
      reason: "APPOINTMENT_NOT_PAYABLE",
      message: "Este turno ya no admite el pago de una seña.",
    };
  }

  const reusable = await repository.findReusableAttempt(appointment.id, now);
  if (reusable?.checkoutUrl) {
    return {
      accepted: true,
      required: true,
      checkoutUrl: reusable.checkoutUrl,
      reference: reusable.externalReference,
      amountCents: reusable.amountCents,
    };
  }

  const attempt = reusable ?? await repository.createAttempt({
    appointmentId: appointment.id,
    externalReference: `deposit:${randomUUID()}`,
    amountCents: policy.amountCents,
    expiresAt: new Date(now.getTime() + policy.expirationMinutes * 60_000),
    now,
  });
  if (!attempt) {
    return {
      accepted: false,
      reason: "APPOINTMENT_NOT_PAYABLE",
      message: "Este turno ya no admite el pago de una seña.",
    };
  }
  // A concurrent start may have finished the checkout while this one waited for the lock.
  if (attempt.checkoutUrl) {
    return {
      accepted: true,
      required: true,
      checkoutUrl: attempt.checkoutUrl,
      reference: attempt.externalReference,
      amountCents: attempt.amountCents,
    };
  }

  try {
    const preference = await port.createPreference({
      externalReference: attempt.externalReference,
      title: `Seña ${appointment.serviceName} · turno ${appointment.publicCode}`,
      amountCents: attempt.amountCents,
      payerEmail: appointment.customerEmail,
      expiresAt: attempt.expiresAt,
    });
    // Whoever stores first wins; everyone is sent to that single stored checkout.
    const stored = await repository.markPreferenceCreated({
      attemptId: attempt.id,
      preferenceId: preference.preferenceId,
      checkoutUrl: preference.checkoutUrl,
    });
    return {
      accepted: true,
      required: true,
      checkoutUrl: stored.checkoutUrl ?? preference.checkoutUrl,
      reference: attempt.externalReference,
      amountCents: attempt.amountCents,
    };
  } catch (error) {
    await repository.markPreferenceFailed(attempt.id, safeErrorMessage(error));
    return {
      accepted: false,
      reason: "PAYMENT_UNAVAILABLE",
      message: "El turno fue recibido, pero Mercado Pago no está disponible. Intentá el pago nuevamente más tarde.",
    };
  }
}

export async function processMercadoPagoPayment(
  repository: DepositPaymentRepository,
  port: MercadoPagoPort,
  input: { paymentId: string; expectedLiveMode?: boolean },
): Promise<PaymentProcessingResult> {
  return applyMercadoPagoPayment(repository, await port.getPayment(input.paymentId), input.expectedLiveMode);
}

type PaymentProcessingResult =
  | { accepted: true; status: DepositPaymentStatus }
  | { accepted: false; reason: "UNKNOWN_REFERENCE" | "PAYMENT_MISMATCH" };

/**
 * Pulls every payment Mercado Pago holds for an attempt and applies them oldest first. This is how
 * a deposit is settled when no webhook arrives: test credentials never send notifications, and a
 * notification can be lost. Status rules keep the result independent of the order.
 */
export async function reconcileDepositAttempt(
  repository: DepositPaymentRepository,
  port: MercadoPagoPort,
  input: { externalReference: string; expectedLiveMode?: boolean },
): Promise<DepositPaymentStatus | null> {
  const payments = (await port.searchPayments(input.externalReference)).reverse();
  let status: DepositPaymentStatus | null = null;
  for (const payment of payments) {
    const result = await applyMercadoPagoPayment(repository, payment, input.expectedLiveMode);
    if (result.accepted) status = result.status;
  }
  return status;
}

/** Hook the expiry sweep calls before cancelling a reservation, so a paid one is confirmed instead. */
export type DepositReconciler = (externalReference: string) => Promise<void>;

async function applyMercadoPagoPayment(
  repository: DepositPaymentRepository,
  payment: ProviderPayment,
  expectedLiveMode: boolean | undefined,
): Promise<PaymentProcessingResult> {
  if (!payment.externalReference) return { accepted: false, reason: "UNKNOWN_REFERENCE" };
  const attempt = await repository.findByExternalReference(payment.externalReference);
  if (!attempt) return { accepted: false, reason: "UNKNOWN_REFERENCE" };

  if (
    Math.round(payment.amount * 100) !== attempt.amountCents ||
    payment.currency !== attempt.currency ||
    (expectedLiveMode !== undefined && payment.liveMode !== expectedLiveMode)
  ) {
    await repository.markAttemptError(attempt.id, "Provider amount or currency did not match the deposit attempt.");
    return { accepted: false, reason: "PAYMENT_MISMATCH" };
  }

  const updated = await repository.applyProviderPayment({
    attemptId: attempt.id,
    providerPaymentId: payment.id,
    status: mapMercadoPagoStatus(payment.status),
    statusDetail: payment.statusDetail,
    liveMode: payment.liveMode,
    approvedAt: payment.approvedAt,
  });
  return { accepted: true, status: updated.status };
}

/** Money already collected is never "un-collected" by a late or out-of-order notification. */
export const settledPaymentStatuses: readonly DepositPaymentStatus[] = ["APPROVED", "REFUNDED", "CHARGED_BACK"];

/**
 * Webhooks can arrive out of order and several payments can share one checkout. Once an attempt is
 * approved it may only move to a refund or chargeback; refunds and chargebacks are final.
 */
export function resolveAttemptStatus(current: DepositPaymentStatus, incoming: DepositPaymentStatus): DepositPaymentStatus {
  if (current === "REFUNDED" || current === "CHARGED_BACK") return current;
  if (current === "APPROVED") return settledPaymentStatuses.includes(incoming) ? incoming : current;
  return incoming;
}

export function mapMercadoPagoStatus(status: string): DepositPaymentStatus {
  const statuses: Record<string, DepositPaymentStatus> = {
    approved: "APPROVED",
    pending: "PENDING",
    in_process: "PENDING",
    authorized: "PENDING",
    rejected: "REJECTED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
    expired: "EXPIRED",
    refunded: "REFUNDED",
    charged_back: "CHARGED_BACK",
  };
  return statuses[status] ?? "ERROR";
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Unknown Mercado Pago error.";
}
