import { z } from "zod";
import {
  scheduleBreakSchema,
  scheduleDateExceptionSchema,
  weeklyScheduleSchema,
  type ScheduleBreak,
  type ScheduleDateException,
  type WeeklySchedule,
} from "@/src/modules/settings/schemas";

export type InternalWeeklyScheduleRecord = {
  schedules: WeeklySchedule[];
  breaks: ScheduleBreak[];
};

export type ImportedHoliday = {
  date: string;
  label: string;
};

export type DateExceptionImportSummary = {
  imported: number;
  created: number;
  updated: number;
  preserved: number;
};

export type InternalScheduleRepository = {
  getWeeklySchedule(): Promise<InternalWeeklyScheduleRecord>;
  replaceWeeklySchedule(input: InternalWeeklyScheduleRecord): Promise<InternalWeeklyScheduleRecord>;
  listDateExceptions(range: { from: string; to: string }): Promise<ScheduleDateException[]>;
  saveDateException(input: Omit<ScheduleDateException, "source" | "manualOverride">): Promise<ScheduleDateException>;
  deleteDateException(date: string): Promise<void>;
  upsertImportedDateExceptions(holidays: ImportedHoliday[]): Promise<DateExceptionImportSummary>;
};

export type InternalWorkshopSettingsRecord = {
  capacity: number;
  minimumNoticeMinutes: number;
  maximumBookingWindowDays: number;
};

export type InternalServiceRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
};

export type InternalMaintenanceRepository = {
  getWorkshopSettings?(): Promise<InternalWorkshopSettingsRecord>;
  listServices?(): Promise<InternalServiceRecord[]>;
  updateWorkshopSettings(input: InternalWorkshopSettingsRecord): Promise<InternalWorkshopSettingsRecord>;
  updateServiceVisibility(serviceId: string, isActive: boolean): Promise<InternalServiceRecord>;
};

const settingsInputSchema = z.object({
  capacity: z.coerce.number().int().min(1).max(20),
  minimumNoticeMinutes: z.coerce.number().int().min(0).max(10_080),
  maximumBookingWindowDays: z.coerce.number().int().min(1).max(365),
});

export async function updateInternalWorkshopSettings(
  repository: InternalMaintenanceRepository,
  input: z.input<typeof settingsInputSchema>,
): Promise<{ accepted: true; settings: InternalWorkshopSettingsRecord }> {
  return { accepted: true, settings: await repository.updateWorkshopSettings(settingsInputSchema.parse(input)) };
}

const weeklyScheduleUpdateSchema = z
  .object({
    schedules: z.array(weeklyScheduleSchema),
    breaks: z.array(scheduleBreakSchema),
  })
  .superRefine((value, ctx) => {
    const byDay = new Map(value.schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
    if (byDay.size !== 7 || value.schedules.length !== 7) {
      ctx.addIssue({ code: "custom", path: ["schedules"], message: "The weekly schedule must cover every weekday exactly once." });
      return;
    }

    for (const [index, scheduleBreak] of value.breaks.entries()) {
      const schedule = byDay.get(scheduleBreak.dayOfWeek);
      if (!schedule?.isOpen) {
        ctx.addIssue({ code: "custom", path: ["breaks", index], message: "A break needs an open day." });
        continue;
      }

      if (scheduleBreak.startsAt < schedule.opensAt || scheduleBreak.endsAt > schedule.closesAt) {
        ctx.addIssue({ code: "custom", path: ["breaks", index], message: "A break must stay inside the opening hours." });
      }

      const overlaps = value.breaks.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.dayOfWeek === scheduleBreak.dayOfWeek &&
          other.startsAt < scheduleBreak.endsAt &&
          other.endsAt > scheduleBreak.startsAt,
      );
      if (overlaps) {
        ctx.addIssue({ code: "custom", path: ["breaks", index], message: "Breaks of the same day must not overlap." });
      }
    }
  });

export type WeeklyScheduleUpdateInput = z.input<typeof weeklyScheduleUpdateSchema>;

export type DateExceptionInput = {
  date: string;
  label?: string | null;
  isOpen: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
};

export type MaintenanceRejection = { accepted: false; reason: "VALIDATION_FAILED"; message: string };

export async function updateInternalWeeklySchedule(
  repository: InternalScheduleRepository,
  input: WeeklyScheduleUpdateInput,
): Promise<{ accepted: true; schedule: InternalWeeklyScheduleRecord } | MaintenanceRejection> {
  const parsed = weeklyScheduleUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return rejection("Revisa los horarios: cada dia debe abrir antes de cerrar y los descansos deben quedar dentro del horario.");
  }

  return { accepted: true, schedule: await repository.replaceWeeklySchedule(parsed.data) };
}

export async function saveInternalDateException(
  repository: InternalScheduleRepository,
  input: DateExceptionInput,
): Promise<{ accepted: true; exception: ScheduleDateException } | MaintenanceRejection> {
  const parsed = scheduleDateExceptionSchema.safeParse({
    date: input.date,
    label: emptyToNull(input.label),
    source: "MANUAL",
    manualOverride: true,
    isOpen: input.isOpen,
    opensAt: input.isOpen ? emptyToNull(input.opensAt) : null,
    closesAt: input.isOpen ? emptyToNull(input.closesAt) : null,
  });

  if (!parsed.success) {
    return rejection("Revisa la fecha: una apertura excepcional necesita horario de apertura y cierre validos.");
  }

  const { source: _source, manualOverride: _manualOverride, ...exception } = parsed.data;
  return { accepted: true, exception: await repository.saveDateException(exception) };
}

export async function deleteInternalDateException(
  repository: InternalScheduleRepository,
  input: { date: string },
): Promise<{ accepted: true } | MaintenanceRejection> {
  const parsed = scheduleDateExceptionSchema.shape.date.safeParse(input.date);
  if (!parsed.success) return rejection("La fecha de la excepcion no es valida.");

  await repository.deleteDateException(parsed.data);
  return { accepted: true };
}

function rejection(message: string): MaintenanceRejection {
  return { accepted: false, reason: "VALIDATION_FAILED", message };
}

function emptyToNull(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

export async function updateInternalServiceVisibility(
  repository: InternalMaintenanceRepository,
  input: { serviceId: string; isActive: boolean },
): Promise<{ accepted: true; service: InternalServiceRecord }> {
  return { accepted: true, service: await repository.updateServiceVisibility(input.serviceId, input.isActive) };
}
