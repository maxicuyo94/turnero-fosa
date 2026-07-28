import { z } from "zod";

export const appointmentStatusSchema = z.enum([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const activeAppointmentStatuses = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
] as const satisfies readonly AppointmentStatus[];

export const appointmentSchema = z
  .object({
    startAt: z.date(),
    endAt: z.date(),
    status: appointmentStatusSchema,
    notes: z.string().max(1_000).optional(),
  })
  .refine((appointment) => appointment.endAt > appointment.startAt, {
    message: "Appointment end time must be after start time.",
    path: ["endAt"],
  });

export type AppointmentInput = z.infer<typeof appointmentSchema>;

export function countsTowardCapacity(status: AppointmentStatus): boolean {
  return activeAppointmentStatuses.includes(status as (typeof activeAppointmentStatuses)[number]);
}
