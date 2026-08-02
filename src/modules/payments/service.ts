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
  createAttempt(input: {
    appointmentId: string;
    externalReference: string;
    amountCents: number;
    expiresAt: Date;
  }): Promise<DepositPaymentAttemptRecord>;
  markPreferenceCreated(input: {
    attemptId: string;
    preferenceId: string;
    checkoutUrl: string;
  }): Promise<DepositPaymentAttemptRecord>;
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
  getPayment(paymentId: string): Promise<{
    id: string;
    externalReference: string | null;
    amount: number;
    currency: string;
    status: string;
    statusDetail: string | null;
    liveMode: boolean;
    approvedAt: Date | null;
  }>;
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
  });

  try {
    const preference = await port.createPreference({
      externalReference: attempt.externalReference,
      title: `Seña ${appointment.serviceName} · turno ${appointment.publicCode}`,
      amountCents: attempt.amountCents,
      payerEmail: appointment.customerEmail,
      expiresAt: attempt.expiresAt,
    });
    await repository.markPreferenceCreated({
      attemptId: attempt.id,
      preferenceId: preference.preferenceId,
      checkoutUrl: preference.checkoutUrl,
    });
    return {
      accepted: true,
      required: true,
      checkoutUrl: preference.checkoutUrl,
      reference: attempt.externalReference,
      amountCents: attempt.amountCents,
    };
  } catch (error) {
    await repository.markAttemptError(attempt.id, safeErrorMessage(error));
    return {
      accepted: false,
      reason: "PAYMENT_UNAVAILABLE",
      message: "El turno fue recibido, pero Mercado Pago no esta disponible. Intenta el pago nuevamente mas tarde.",
    };
  }
}

export async function processMercadoPagoPayment(
  repository: DepositPaymentRepository,
  port: MercadoPagoPort,
  input: { paymentId: string; expectedLiveMode?: boolean },
): Promise<{ accepted: true; status: DepositPaymentStatus } | { accepted: false; reason: "UNKNOWN_REFERENCE" | "PAYMENT_MISMATCH" }> {
  const payment = await port.getPayment(input.paymentId);
  if (!payment.externalReference) return { accepted: false, reason: "UNKNOWN_REFERENCE" };
  const attempt = await repository.findByExternalReference(payment.externalReference);
  if (!attempt) return { accepted: false, reason: "UNKNOWN_REFERENCE" };

  if (
    Math.round(payment.amount * 100) !== attempt.amountCents ||
    payment.currency !== attempt.currency ||
    (input.expectedLiveMode !== undefined && payment.liveMode !== input.expectedLiveMode)
  ) {
    await repository.markAttemptError(attempt.id, "Provider amount or currency did not match the deposit attempt.");
    return { accepted: false, reason: "PAYMENT_MISMATCH" };
  }

  const status = mapMercadoPagoStatus(payment.status);
  await repository.applyProviderPayment({
    attemptId: attempt.id,
    providerPaymentId: payment.id,
    status,
    statusDetail: payment.statusDetail,
    liveMode: payment.liveMode,
    approvedAt: payment.approvedAt,
  });
  return { accepted: true, status };
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
