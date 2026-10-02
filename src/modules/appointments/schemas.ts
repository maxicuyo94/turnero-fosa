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

export function countsTowardCapacity(status: AppointmentStatus): boolean {
  return activeAppointmentStatuses.includes(status as (typeof activeAppointmentStatuses)[number]);
}
