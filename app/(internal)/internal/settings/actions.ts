"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { workshopSettingsRepository } from "@/src/lib/composition";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import {
  createInternalVehicleType,
  deleteInternalDateException,
  saveInternalDateException,
  updateInternalBookingSettings,
  updateInternalContactSettings,
  updateInternalServiceDuration,
  updateInternalServiceVisibility,
  updateInternalVehicleTypeVisibility,
  updateInternalWeeklySchedule,
  type WeeklyScheduleUpdateInput,
} from "@/src/modules/settings/maintenance";
import { settingsPaths, type SettingsFeedbackCode, type SettingsPage } from "@/src/modules/internal/settings-navigation";
import { ArgentinaDatosHolidayProvider } from "@/src/modules/settings/argentinadatos-adapter";
import { importArgentineHolidays } from "@/src/modules/settings/holiday-import";
import { dayOfWeekSchema, type DayOfWeek } from "@/src/modules/settings/schemas";

// Everything here changes how the workshop operates, so it is reserved to administrators.

export async function updateContactSettingsAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  try {
    await updateInternalContactSettings(workshopSettingsRepository(), {
      publicPhone: formString(formData, "publicPhone"),
      whatsappNumber: formString(formData, "whatsappNumber"),
      publicAppUrl: formString(formData, "publicAppUrl"),
      emailFrom: formString(formData, "emailFrom"),
    });
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    redirect(settingsUrl("general", "contact-invalid"));
  }
  revalidatePath("/", "layout");
  redirect(settingsUrl("general", "settings-updated"));
}

export async function updateBookingSettingsAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  try {
    await updateInternalBookingSettings(workshopSettingsRepository(), {
      confirmationMode: formString(formData, "confirmationMode") === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL",
      cancellationEnabled: formString(formData, "cancellationEnabled") === "true",
      capacity: formString(formData, "capacity"),
      minimumNoticeMinutes: formString(formData, "minimumNoticeMinutes"),
      maximumBookingWindowDays: formString(formData, "maximumBookingWindowDays"),
      depositRequired: formString(formData, "depositRequired") === "true",
      depositAmountArs: formString(formData, "depositAmountArs"),
      depositExpirationMinutes: formString(formData, "depositExpirationMinutes"),
      depositRefundPolicy: formString(formData, "depositRefundPolicy"),
      depositActivationDate: formString(formData, "depositActivationDate"),
    });
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    redirect(settingsUrl("booking", "booking-invalid"));
  }
  revalidatePath("/", "layout");
  redirect(settingsUrl("booking", "settings-updated"));
}

export async function updateServiceDurationAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await updateInternalServiceDuration(workshopSettingsRepository(), {
    serviceId: formString(formData, "serviceId"),
    durationMinutes: formString(formData, "durationMinutes"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl("catalog", result.accepted ? "service-updated" : "service-invalid"));
}

export async function updateServiceVisibilityAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  await updateInternalServiceVisibility(workshopSettingsRepository(), {
    serviceId: formString(formData, "serviceId"),
    isActive: formString(formData, "isActive") === "true",
  });
  redirect(settingsUrl("catalog"));
}

export async function createVehicleTypeAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await createInternalVehicleType(workshopSettingsRepository(), {
    name: formString(formData, "name"),
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl("catalog", result.accepted ? "vehicle-type-created" : "vehicle-type-invalid"));
}

export async function updateVehicleTypeVisibilityAction(formData: FormData) {
  await requireStaff({ role: "ADMIN" });
  const result = await updateInternalVehicleTypeVisibility(workshopSettingsRepository(), {
    vehicleTypeId: formString(formData, "vehicleTypeId"),
    isActive: formString(formData, "isActive") === "true",
  });
  if (result.accepted) revalidatePath("/", "layout");
  redirect(settingsUrl("catalog", result.accepted ? "vehicle-type-updated" : "vehicle-type-invalid"));
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

/** Feedback travels as a code so the panel never renders text taken from the URL. */
function settingsUrl(page: SettingsPage, feedback?: SettingsFeedbackCode): string {
  return feedback ? `${settingsPaths[page]}?${new URLSearchParams({ feedback }).toString()}` : settingsPaths[page];
}

/** Like `settingsUrl`, keeping the date whose year the schedule page was showing. */
function scheduleUrl(formData: FormData, feedback: SettingsFeedbackCode): string {
  const date = formString(formData, "agendaDate");
  const params = new URLSearchParams(date ? { date, feedback } : { feedback });
  return `${settingsPaths.schedule}?${params.toString()}`;
}

function holidayFailureFeedback(reason: "VALIDATION_FAILED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID"): SettingsFeedbackCode {
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
