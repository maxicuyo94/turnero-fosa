"use server";

import { redirect } from "next/navigation";
import { auth, getInternalSessionUserId, isInternalSession, signOut } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getNotificationEnv } from "@/src/lib/env";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";
import { appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import {
  previewInternalAppointmentSlots,
  rescheduleInternalAppointment,
  updateInternalAppointmentStatus,
} from "@/src/modules/internal/operations";
import {
  deleteInternalDateException,
  saveInternalDateException,
  updateInternalServiceVisibility,
  updateInternalWeeklySchedule,
  updateInternalWorkshopSettings,
  type WeeklyScheduleUpdateInput,
} from "@/src/modules/internal/maintenance";
import { ArgentinaDatosHolidayProvider } from "@/src/modules/internal/argentinadatos-adapter";
import { importArgentineHolidays } from "@/src/modules/internal/holiday-import";
import { dayOfWeekSchema, type DayOfWeek } from "@/src/modules/settings/schemas";
import { PrismaNotificationLogRepository } from "@/src/modules/notifications/prisma-repository";
import { ResendNotificationPort } from "@/src/modules/notifications/resend-adapter";

export async function updateAppointmentStatusAction(formData: FormData) {
  const changedById = await requireInternalAccess();
  const repository = new PrismaInternalRepository(db);
  const notificationEnv = getNotificationEnv();
  await updateInternalAppointmentStatus(repository, {
    appointmentId: stringValue(formData, "appointmentId"),
    nextStatus: appointmentStatusSchema.parse(stringValue(formData, "nextStatus")),
    changedById,
  }, notificationEnv
    ? {
        logRepository: new PrismaNotificationLogRepository(db),
        port: new ResendNotificationPort(notificationEnv),
      }
    : undefined);
  redirect(`/internal?date=${encodeURIComponent(stringValue(formData, "date"))}`);
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const changedById = await requireInternalAccess();
  const notificationEnv = getNotificationEnv();
  const result = await rescheduleInternalAppointment(new PrismaInternalRepository(db), {
    appointmentId: stringValue(formData, "appointmentId"),
    date: stringValue(formData, "targetDate"),
    startTime: stringValue(formData, "startTime"),
    durationMinutes: stringValue(formData, "durationMinutes"),
    changedById,
    reason: stringValue(formData, "reason") || undefined,
  }, notificationEnv
    ? {
        logRepository: new PrismaNotificationLogRepository(db),
        port: new ResendNotificationPort(notificationEnv),
      }
    : undefined);
  const message = result.accepted ? "El turno fue reprogramado correctamente." : result.message;
  const date = result.accepted ? stringValue(formData, "targetDate") : stringValue(formData, "agendaDate");
  redirect(`/internal?date=${encodeURIComponent(date)}&appointmentUpdated=${result.accepted ? "1" : "0"}&message=${encodeURIComponent(message)}`);
}

export async function previewAppointmentAvailabilityAction(input: {
  appointmentId: string;
  date: string;
  durationMinutes: number;
}) {
  await requireInternalAccess();
  return previewInternalAppointmentSlots(new PrismaInternalRepository(db), input);
}

export async function updateWorkshopSettingsAction(formData: FormData) {
  await requireInternalAccess();
  await updateInternalWorkshopSettings(new PrismaInternalRepository(db), {
    capacity: stringValue(formData, "capacity"),
    minimumNoticeMinutes: stringValue(formData, "minimumNoticeMinutes"),
    maximumBookingWindowDays: stringValue(formData, "maximumBookingWindowDays"),
  });
  redirect("/internal?section=settings");
}

export async function updateServiceVisibilityAction(formData: FormData) {
  await requireInternalAccess();
  await updateInternalServiceVisibility(new PrismaInternalRepository(db), {
    serviceId: stringValue(formData, "serviceId"),
    isActive: stringValue(formData, "isActive") === "true",
  });
  redirect("/internal?section=settings");
}

export async function updateWeeklyScheduleAction(formData: FormData) {
  await requireInternalAccess();
  const result = await updateInternalWeeklySchedule(new PrismaInternalRepository(db), parseWeeklySchedule(formData));
  redirect(internalUrl(formData, result.accepted ? "schedule-updated" : "schedule-invalid"));
}

export async function saveDateExceptionAction(formData: FormData) {
  await requireInternalAccess();
  const result = await saveInternalDateException(new PrismaInternalRepository(db), {
    date: stringValue(formData, "date"),
    label: stringValue(formData, "label"),
    isOpen: stringValue(formData, "isOpen") === "true",
    opensAt: stringValue(formData, "opensAt"),
    closesAt: stringValue(formData, "closesAt"),
  });
  redirect(internalUrl(formData, result.accepted ? "exception-saved" : "exception-invalid"));
}

export async function deleteDateExceptionAction(formData: FormData) {
  await requireInternalAccess();
  const result = await deleteInternalDateException(new PrismaInternalRepository(db), {
    date: stringValue(formData, "exceptionDate"),
  });
  redirect(internalUrl(formData, result.accepted ? "exception-deleted" : "exception-invalid"));
}

export async function importHolidaysAction(formData: FormData) {
  await requireInternalAccess();
  const result = await importArgentineHolidays(
    new PrismaInternalRepository(db),
    new ArgentinaDatosHolidayProvider(),
    { year: stringValue(formData, "year") },
  );
  redirect(internalUrl(formData, result.accepted ? "holidays-imported" : holidayFailureFeedback(result.reason)));
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

/** Feedback travels as a code so the panel never renders text taken from the URL. */
function internalUrl(formData: FormData, feedback: string): string {
  const date = stringValue(formData, "agendaDate");
  const params = new URLSearchParams(date ? { section: "settings", date, feedback } : { section: "settings", feedback });
  return `/internal?${params.toString()}`;
}

function holidayFailureFeedback(reason: "VALIDATION_FAILED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID"): string {
  return reason === "PROVIDER_UNAVAILABLE" ? "holidays-unavailable" : "holidays-invalid";
}

function parseWeeklySchedule(formData: FormData): WeeklyScheduleUpdateInput {
  return {
    schedules: dayOfWeekSchema.options.map((dayOfWeek) => ({
      dayOfWeek,
      opensAt: stringValue(formData, `opensAt-${dayOfWeek}`),
      closesAt: stringValue(formData, `closesAt-${dayOfWeek}`),
      isOpen: stringValue(formData, `isOpen-${dayOfWeek}`) === "true",
    })),
    breaks: parseBreaks(formData),
  };
}

/**
 * Break rows arrive as `break-<day>-<index>-startsAt|endsAt`. A row with both ends empty is the
 * spare row of the form; a half-filled row is kept so validation reports it instead of dropping it.
 */
function parseBreaks(formData: FormData): WeeklyScheduleUpdateInput["breaks"] {
  const breaks: WeeklyScheduleUpdateInput["breaks"] = [];

  for (const key of formData.keys()) {
    const match = /^break-([A-Z]+)-(\d+)-startsAt$/u.exec(key);
    if (!match) continue;

    const startsAt = stringValue(formData, key);
    const endsAt = stringValue(formData, `break-${match[1]}-${match[2]}-endsAt`);
    if (!startsAt && !endsAt) continue;

    breaks.push({ dayOfWeek: match[1] as DayOfWeek, startsAt, endsAt });
  }

  return breaks;
}
