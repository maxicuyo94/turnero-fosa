"use server";

import { redirect } from "next/navigation";
import { auth, getInternalSessionUserId, isInternalSession, signOut } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getEnv } from "@/src/lib/env";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";
import { appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import { updateInternalAppointmentStatus } from "@/src/modules/internal/operations";
import { updateInternalServiceVisibility, updateInternalWorkshopSettings } from "@/src/modules/internal/maintenance";
import { PrismaNotificationLogRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";

export async function updateAppointmentStatusAction(formData: FormData) {
  const changedById = await requireInternalAccess();
  const repository = new PrismaInternalRepository(db);
  const env = getEnv();
  await updateInternalAppointmentStatus(repository, {
    appointmentId: stringValue(formData, "appointmentId"),
    nextStatus: appointmentStatusSchema.parse(stringValue(formData, "nextStatus")),
    changedById,
  }, {
    logRepository: new PrismaNotificationLogRepository(db),
    port: new ResendNotificationPort(env),
  });
  redirect(`/internal?date=${encodeURIComponent(stringValue(formData, "date"))}`);
}

export async function updateWorkshopSettingsAction(formData: FormData) {
  await requireInternalAccess();
  await updateInternalWorkshopSettings(new PrismaInternalRepository(db), {
    capacity: stringValue(formData, "capacity"),
    minimumNoticeMinutes: stringValue(formData, "minimumNoticeMinutes"),
    maximumBookingWindowDays: stringValue(formData, "maximumBookingWindowDays"),
  });
  redirect("/internal");
}

export async function updateServiceVisibilityAction(formData: FormData) {
  await requireInternalAccess();
  await updateInternalServiceVisibility(new PrismaInternalRepository(db), {
    serviceId: stringValue(formData, "serviceId"),
    isActive: stringValue(formData, "isActive") === "true",
  });
  redirect("/internal");
}

export async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/internal/login" });
}

async function requireInternalAccess(): Promise<string | null> {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");
  return getInternalSessionUserId(session);
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
