"use server";

import { redirect } from "next/navigation";
import { db } from "@/src/lib/db";
import { getNotificationEnv } from "@/src/lib/env";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { cancelPublicAppointment, createPublicBooking } from "@/src/modules/booking/service";
import { PrismaNotificationLogRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";

export async function createAppointmentAction(formData: FormData) {
  const repository = new PrismaBookingRepository(db);
  const notificationEnv = getNotificationEnv();
  const result = await createPublicBooking(repository, {
    serviceId: stringValue(formData, "serviceId"),
    date: stringValue(formData, "date"),
    startTime: stringValue(formData, "startTime"),
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
  const cancelParam = cancellationUrl ? `&cancel=${encodeURIComponent(cancellationUrl)}` : "";
  redirect(`/booking?booked=1&message=${encodeURIComponent(result.message)}&code=${encodeURIComponent(result.appointment.publicCode)}${cancelParam}`);
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
