"use server";

import { redirect } from "next/navigation";
import { auth, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getWorkshopPaymentEnv, getWorkshopNotificationEnv } from "@/src/modules/settings/runtime-settings";
import { bookingOutcomeQuery, type BookingResultCode, type PaymentIssueCode } from "@/src/modules/booking/booking-outcome";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { cancelPublicAppointment, createPublicBooking } from "@/src/modules/booking/service";
import { PrismaNotificationLogRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";
import { MercadoPagoAdapter } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { initiateAppointmentDeposit } from "@/src/modules/payments/service";

export async function createAppointmentAction(formData: FormData) {
  const repository = new PrismaBookingRepository(db);
  const notificationEnv = await getWorkshopNotificationEnv(db);
  // La duracion total la define el servicio salvo que reserve una sesion interna.
  const canEditDuration = isInternalSession(await auth());
  const result = await createPublicBooking(repository, {
    serviceId: stringValue(formData, "serviceId"),
    date: stringValue(formData, "date"),
    startTime: stringValue(formData, "startTime"),
    durationMinutes: canEditDuration ? numberValue(formData, "durationMinutes") : undefined,
    customer: {
      fullName: stringValue(formData, "fullName"),
      phone: stringValue(formData, "phone"),
      email: optionalStringValue(formData, "email"),
    },
    motorcycle: {
      brand: stringValue(formData, "brand"),
      model: stringValue(formData, "model"),
      licensePlate: optionalStringValue(formData, "licensePlate"),
    },
    notes: optionalStringValue(formData, "notes"),
    idempotencyKey: stringValue(formData, "idempotencyKey"),
    now: new Date(),
  }, notificationEnv
    ? {
        logRepository: new PrismaNotificationLogRepository(db),
        port: new ResendNotificationPort(notificationEnv),
      }
    : undefined);

  if (!result.accepted) {
    const query = bookingOutcomeQuery({ result: bookingFailureCode(result) });
    query.set("serviceId", stringValue(formData, "serviceId"));
    query.set("date", stringValue(formData, "date"));
    redirect(`/booking?${query.toString()}`);
  }

  const cancellationUrl = result.cancellationToken
    ? `/booking/cancel?appointmentId=${encodeURIComponent(result.appointment.id)}&token=${encodeURIComponent(result.cancellationToken)}`
    : undefined;
  const payment = result.depositRequired ? await startDeposit(result.appointment.id) : undefined;
  redirect(`/booking?${bookingOutcomeQuery({
    result: result.repeated ? "repeated" : "created",
    code: result.appointment.publicCode,
    cancel: cancellationUrl,
    payment,
  }).toString()}`);
}

export async function retryDepositAction(formData: FormData) {
  const publicCode = stringValue(formData, "publicCode").trim().toUpperCase();
  const appointment = await new PrismaBookingRepository(db).findByPublicCode(publicCode);
  if (!appointment) {
    redirect(`/booking?${bookingOutcomeQuery({ result: "not-found", payment: "not-found" }).toString()}`);
  }

  const payment = await startDeposit(appointment.id);
  redirect(`/booking?${bookingOutcomeQuery({ result: "payment-retry", code: appointment.publicCode, payment }).toString()}`);
}

/** Starts or reuses the Mercado Pago checkout; returns the issue code when there is none to offer. */
async function startDeposit(appointmentId: string): Promise<PaymentIssueCode | undefined> {
  const paymentEnv = await getWorkshopPaymentEnv(db);
  if (!paymentEnv) return "disabled";
  const payment = await initiateAppointmentDeposit(
    new PrismaDepositPaymentRepository(db),
    new MercadoPagoAdapter(paymentEnv),
    { appointmentId },
  );
  if (payment.accepted) return undefined;
  return payment.reason === "PAYMENT_UNAVAILABLE" ? "unavailable" : payment.reason === "APPOINTMENT_NOT_FOUND" ? "not-found" : "not-payable";
}

function bookingFailureCode(result: Extract<Awaited<ReturnType<typeof createPublicBooking>>, { accepted: false }>): BookingResultCode {
  if (result.reason === "SLOT_UNAVAILABLE") return "slot-unavailable";
  if (result.reason === "SERVICE_UNAVAILABLE") return "service-unavailable";
  return result.fieldErrors?.durationMinutes ? "invalid-duration" : "invalid";
}

export async function cancelAppointmentAction(formData: FormData) {
  const repository = new PrismaBookingRepository(db);
  const result = await cancelPublicAppointment(repository, {
    appointmentId: stringValue(formData, "appointmentId"),
    token: stringValue(formData, "token"),
    now: new Date(),
  });

  // The outcome travels as a code so the page picks its own wording and tone.
  redirect(`/booking/cancel?result=${result.accepted ? "cancelled" : "unavailable"}`);
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalStringValue(formData: FormData, key: string): string | undefined {
  const value = stringValue(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function numberValue(formData: FormData, key: string): number | undefined {
  const value = stringValue(formData, key).trim();
  return value ? Number(value) : undefined;
}
