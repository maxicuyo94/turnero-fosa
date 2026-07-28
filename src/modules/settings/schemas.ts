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
