import { z } from "zod";

export const dayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/u, "Time must use HH:mm format.");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Date must use YYYY-MM-DD format.");

export const workshopSettingsSchema = z.object({
  workshopName: z.string().trim().min(1),
  capacity: z.number().int().positive(),
  slotStepMinutes: z.number().int().positive(),
  minimumNoticeMinutes: z.number().int().nonnegative(),
  maximumBookingWindowDays: z.number().int().positive(),
  confirmationMode: z.enum(["MANUAL", "AUTOMATIC"]),
  cancellationEnabled: z.boolean(),
  reschedulingEnabled: z.boolean(),
});

export type WorkshopSettings = z.infer<typeof workshopSettingsSchema>;

export const weeklyScheduleSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    opensAt: timeSchema,
    closesAt: timeSchema,
    isOpen: z.boolean(),
  })
  .refine((schedule) => !schedule.isOpen || schedule.closesAt > schedule.opensAt, {
    message: "Closing time must be after opening time.",
    path: ["closesAt"],
  });

export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

export const scheduleBreakSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((scheduleBreak) => scheduleBreak.endsAt > scheduleBreak.startsAt, {
    message: "Break end time must be after start time.",
    path: ["endsAt"],
  });

export type ScheduleBreak = z.infer<typeof scheduleBreakSchema>;

export const scheduleExceptionSourceSchema = z.enum(["IMPORTED", "MANUAL"]);

export type ScheduleExceptionSource = z.infer<typeof scheduleExceptionSourceSchema>;

export const scheduleDateExceptionSchema = z
  .object({
    date: dateSchema,
    label: z.string().trim().min(1).max(120).nullable(),
    source: scheduleExceptionSourceSchema,
    manualOverride: z.boolean(),
    isOpen: z.boolean(),
    opensAt: timeSchema.nullable(),
    closesAt: timeSchema.nullable(),
  })
  .refine((exception) => !exception.isOpen || (exception.opensAt !== null && exception.closesAt !== null), {
    message: "An exceptionally open date requires opening and closing times.",
    path: ["opensAt"],
  })
  .refine((exception) => !exception.isOpen || !exception.opensAt || !exception.closesAt || exception.closesAt > exception.opensAt, {
    message: "Closing time must be after opening time.",
    path: ["closesAt"],
  });

export type ScheduleDateException = z.infer<typeof scheduleDateExceptionSchema>;
