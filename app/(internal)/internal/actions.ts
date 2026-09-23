"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { signOut } from "@/src/lib/auth";
import { appointmentRepository, deliverOutboxEmailsAfterResponse, workshopSettingsRepository } from "@/src/lib/composition";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import {
  previewInternalAppointmentSlots,
  rescheduleInternalAppointment,
  updateInternalAppointmentStatus,
} from "@/src/modules/appointments/operations";
import {
  deleteInternalDateException,
  saveInternalDateException,
  updateInternalServiceVisibility,
  createInternalVehicleType,
  updateInternalVehicleTypeVisibility,
  updateInternalServiceDuration,
  updateInternalWeeklySchedule,
  updateInternalWorkshopSettings,
  type WeeklyScheduleUpdateInput,
} from "@/src/modules/settings/maintenance";
import type { InternalFeedbackCode } from "@/src/modules/internal/internal-agenda-screen";
import { ArgentinaDatosHolidayProvider } from "@/src/modules/settings/argentinadatos-adapter";
import { parseAgendaView, type AgendaView } from "@/src/modules/appointments/agenda-navigation";
import { importArgentineHolidays } from "@/src/modules/settings/holiday-import";
import { dayOfWeekSchema, type DayOfWeek } from "@/src/modules/settings/schemas";

export async function updateAppointmentStatusAction(formData: FormData) {
  const { userId: changedById } = await requireStaff();
  const date = formString(formData, "date");
  const nextStatus = appointmentStatusSchema.safeParse(formString(formData, "nextStatus"));
  const appointmentId = formString(formData, "appointmentId").trim();
  const view = parseAgendaView(formString(formData, "view"));
  if (!nextStatus.success || !appointmentId) redirect(agendaUrl(date, "status-invalid", view));

  const result = await updateInternalAppointmentStatus(appointmentRepository(), {
    appointmentId,
    nextStatus: nextStatus.data,
    changedById,
  });
  if (result.accepted) deliverOutboxEmailsAfterResponse();
  redirect(agendaUrl(
    date,
    result.accepted ? "status-updated" : result.reason === "APPOINTMENT_NOT_FOUND" ? "appointment-not-found" : "status-invalid",
    view,
  ));
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const { userId: changedById } = await requireStaff();
  let feedback: InternalFeedbackCode;
  let accepted = false;
  try {
    const result = await rescheduleInternalAppointment(appointmentRepository(), {
      appointmentId: formString(formData, "appointmentId"),
      date: formString(formData, "targetDate"),
      startTime: formString(formData, "startTime"),
      durationMinutes: formString(formData, "durationMinutes"),
      changedById,
      reason: formString(formData, "reason") || undefined,
    });
    accepted = result.accepted;
    feedback = result.accepted ? "appointment-rescheduled" : rescheduleFeedback[result.reason];
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    feedback = "reschedule-invalid-input";
  }
  if (accepted) deliverOutboxEmailsAfterResponse();
  redirect(agendaUrl(formString(formData, accepted ? "targetDate" : "agendaDate"), feedback, parseAgendaView(formString(formData, "view"))));
}

const rescheduleFeedback: Record<
  Exclude<Awaited<ReturnType<typeof rescheduleInternalAppointment>>, { accepted: true }>["reason"],
  InternalFeedbackCode
> = {
  APPOINTMENT_NOT_FOUND: "appointment-not-found",
  TERMINAL_APPOINTMENT: "reschedule-terminal",
  INVALID_DURATION: "reschedule-invalid-duration",
  CLOSED_DATE: "reschedule-closed-date",
  OUTSIDE_OPENING_HOURS: "reschedule-outside-opening-hours",
  BREAK_OVERLAP: "reschedule-break-overlap",
  DAY_BOUNDARY_EXCEEDED: "reschedule-day-boundary-exceeded",
  CAPACITY_EXHAUSTED: "reschedule-capacity-exhausted",
};

/** Agenda outcomes travel as codes, like the settings feedback, so no URL text is ever rendered. */
function agendaUrl(date: string, feedback: InternalFeedbackCode, view: AgendaView = "day"): string {
  const params = new URLSearchParams(date ? { date, feedback } : { feedback });
  if (view === "week") params.set("view", "week");
  return `/internal?${params.toString()}`;
}

export async function previewAppointmentAvailabilityAction(input: {
  appointmentId: string;
  date: string;
  durationMinutes: number;
}) {
  await requireStaff();
  return previewInternalAppointmentSlots(appointmentRepository(), input);
}

// Everything below changes how the workshop operates, so it is reserved to administrators.

export async function updateWorkshopSettingsAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  try {
    await updateInternalWorkshopSettings(workshopSettingsRepository(), {
      publicPhone: formString(formData, "publicPhone"),
      whatsappNumber: formString(formData, "whatsappNumber"),
      publicAppUrl: formString(formData, "publicAppUrl"),
      emailFrom: formString(formData, "emailFrom"),
      depositRefundPolicy: formString(formData, "depositRefundPolicy"),
      depositActivationDate: formString(formData, "depositActivationDate"),
      capacity: formString(formData, "capacity"),
      minimumNoticeMinutes: formString(formData, "minimumNoticeMinutes"),
      maximumBookingWindowDays: formString(formData, "maximumBookingWindowDays"),
      depositRequired: formString(formData, "depositRequired") === "true",
      depositAmountArs: formString(formData, "depositAmountArs"),
      depositExpirationMinutes: formString(formData, "depositExpirationMinutes"),
    });
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    redirect(settingsUrl("settings-invalid"));
  }
  revalidatePath("/", "layout");
  redirect(settingsUrl("settings-updated"));
}

export async function updateServiceDurationAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await updateInternalServiceDuration(workshopSettingsRepository(), {
    serviceId: formString(formData, "serviceId"),
    durationMinutes: formString(formData, "durationMinutes"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl(result.accepted ? "service-updated" : "service-invalid"));
}

export async function updateServiceVisibilityAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  await updateInternalServiceVisibility(workshopSettingsRepository(), {
    serviceId: formString(formData, "serviceId"),
    isActive: formString(formData, "isActive") === "true",
  });
  redirect(settingsUrl());
}

export async function createVehicleTypeAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await createInternalVehicleType(workshopSettingsRepository(), {
    name: formString(formData, "name"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl(result.accepted ? "vehicle-type-created" : "vehicle-type-invalid"));
}

export async function updateVehicleTypeVisibilityAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await updateInternalVehicleTypeVisibility(workshopSettingsRepository(), {
    vehicleTypeId: formString(formData, "vehicleTypeId"),
    isActive: formString(formData, "isActive") === "true",
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl(result.accepted ? "vehicle-type-updated" : "vehicle-type-invalid"));
}

export async function updateWeeklyScheduleAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await updateInternalWeeklySchedule(workshopSettingsRepository(), parseWeeklySchedule(formData));
  redirect(scheduleUrl(formData, result.accepted ? "schedule-updated" : "schedule-invalid"));
}

export async function saveDateExceptionAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await saveInternalDateException(workshopSettingsRepository(), {
    date: formString(formData, "date"),
    label: formString(formData, "label"),
    isOpen: formString(formData, "isOpen") === "true",
    opensAt: formString(formData, "opensAt"),
    closesAt: formString(formData, "closesAt"),
  });
  redirect(scheduleUrl(formData, result.accepted ? "exception-saved" : "exception-invalid"));
}

export async function deleteDateExceptionAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await deleteInternalDateException(workshopSettingsRepository(), {
    date: formString(formData, "exceptionDate"),
  });
  redirect(scheduleUrl(formData, result.accepted ? "exception-deleted" : "exception-invalid"));
}

export async function importHolidaysAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await importArgentineHolidays(
    workshopSettingsRepository(),
    new ArgentinaDatosHolidayProvider(),
    { year: formString(formData, "year") },
  );
  redirect(scheduleUrl(formData, result.accepted ? "holidays-imported" : holidayFailureFeedback(result.reason)));
}

export async function signOutAction() {
  await signOut({ redirectTo: "/internal/login" });
}

/** Feedback travels as a code so the panel never renders text taken from the URL. */
function settingsUrl(feedback?: InternalFeedbackCode): string {
  const params = new URLSearchParams(feedback ? { section: "settings", feedback } : { section: "settings" });
  return `/internal?${params.toString()}`;
}

/** Like `settingsUrl`, keeping the agenda date the schedule forms were opened from. */
function scheduleUrl(formData: FormData, feedback: InternalFeedbackCode): string {
  const date = formString(formData, "agendaDate");
  const params = new URLSearchParams(date ? { section: "settings", date, feedback } : { section: "settings", feedback });
  return `/internal?${params.toString()}`;
}

function holidayFailureFeedback(reason: "VALIDATION_FAILED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID"): InternalFeedbackCode {
  return reason === "PROVIDER_UNAVAILABLE" ? "holidays-unavailable" : "holidays-invalid";
}

function parseWeeklySchedule(formData: FormData): WeeklyScheduleUpdateInput {
  return {
    schedules: dayOfWeekSchema.options.map((dayOfWeek) => ({
      dayOfWeek,
      opensAt: formString(formData, `opensAt-${dayOfWeek}`),
      closesAt: formString(formData, `closesAt-${dayOfWeek}`),
      isOpen: formString(formData, `isOpen-${dayOfWeek}`) === "true",
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

    const startsAt = formString(formData, key);
    const endsAt = formString(formData, `break-${match[1]}-${match[2]}-endsAt`);
    if (!startsAt && !endsAt) continue;

    breaks.push({ dayOfWeek: match[1] as DayOfWeek, startsAt, endsAt });
  }

  return breaks;
}
