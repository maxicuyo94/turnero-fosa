"use server";

import { redirect } from "next/navigation";
import { db } from "@/src/lib/db";
import { getMercadoPagoEnv, getNotificationEnv } from "@/src/lib/env";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { cancelPublicAppointment, createPublicBooking } from "@/src/modules/booking/service";
import { PrismaNotificationLogRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";
import { MercadoPagoAdapter } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { initiateAppointmentDeposit } from "@/src/modules/payments/service";

export async function createAppointmentAction(formData: FormData) {
  const repository = new PrismaBookingRepository(db);
  const notificationEnv = getNotificationEnv();
  const result = await createPublicBooking(repository, {
    serviceId: stringValue(formData, "serviceId"),
    date: stringValue(formData, "date"),
    startTime: stringValue(formData, "startTime"),
    durationMinutes: numberValue(formData, "durationMinutes"),
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
    redirect(`/booking?serviceId=${encodeURIComponent(stringValue(formData, "serviceId"))}&date=${encodeURIComponent(stringValue(formData, "date"))}&message=${encodeURIComponent(result.message)}`);
  }

  const cancellationUrl = result.cancellationToken
    ? `/booking/cancel?appointmentId=${encodeURIComponent(result.appointment.id)}&token=${encodeURIComponent(result.cancellationToken)}`
    : undefined;
  const params = new URLSearchParams({ booked: "1", message: result.message, code: result.appointment.publicCode });
  if (cancellationUrl) params.set("cancel", cancellationUrl);

  if (result.depositRequired) {
    const paymentEnv = getMercadoPagoEnv();
    if (paymentEnv) {
      const payment = await initiateAppointmentDeposit(
        new PrismaDepositPaymentRepository(db),
        new MercadoPagoAdapter(paymentEnv),
        { appointmentId: result.appointment.id },
      );
      if (payment.accepted && payment.required) {
        params.set("paymentUrl", payment.checkoutUrl);
        params.set("deposit", String(payment.amountCents));
      } else if (!payment.accepted) {
        params.set("paymentError", payment.message);
      }
    } else {
      params.set("paymentError", "El pago online todavia no esta habilitado. El taller coordinara la seña.");
    }
  }
  redirect(`/booking?${params.toString()}`);
}

export async function retryDepositAction(formData: FormData) {
  const publicCode = stringValue(formData, "publicCode").trim().toUpperCase();
  const appointment = await new PrismaBookingRepository(db).findByPublicCode(publicCode);
  const params = new URLSearchParams({ booked: "1", code: publicCode });

  if (!appointment) {
    params.set("message", "No encontramos el turno para reintentar el pago.");
    params.set("paymentError", "Revisa el codigo del turno e intenta nuevamente.");
    redirect(`/booking?${params.toString()}`);
  }

  const paymentEnv = getMercadoPagoEnv();
  if (!paymentEnv) {
    params.set("message", "El turno sigue registrado, pero la seña esta pendiente.");
    params.set("paymentError", "El pago online todavia no esta habilitado. El taller coordinara la seña.");
    redirect(`/booking?${params.toString()}`);
  }

  const payment = await initiateAppointmentDeposit(
    new PrismaDepositPaymentRepository(db),
    new MercadoPagoAdapter(paymentEnv),
    { appointmentId: appointment.id },
  );
  params.set("message", payment.accepted
    ? "Continua en Mercado Pago para confirmar el turno."
    : "El turno sigue registrado, pero no pudimos iniciar la seña.");
  if (payment.accepted && payment.required) {
    params.set("paymentUrl", payment.checkoutUrl);
    params.set("deposit", String(payment.amountCents));
  } else if (!payment.accepted) {
    params.set("paymentError", payment.message);
  }
  redirect(`/booking?${params.toString()}`);
}

export async function cancelAppointmentAction(formData: FormData) {
  const repository = new PrismaBookingRepository(db);
  const result = await cancelPublicAppointment(repository, {
    appointmentId: stringValue(formData, "appointmentId"),
    token: stringValue(formData, "token"),
    now: new Date(),
  });

  redirect(`/booking/cancel?message=${encodeURIComponent(result.message)}`);
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
