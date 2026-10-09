"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { signOut } from "@/src/lib/auth";
import { appointmentDetails, appointmentRepository, deliverOutboxEmailsAfterResponse } from "@/src/lib/composition";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import {
  previewInternalAppointmentSlots,
  rescheduleInternalAppointment,
  updateInternalAppointmentStatus,
} from "@/src/modules/appointments/operations";
import type { InternalFeedbackCode } from "@/src/modules/internal/internal-agenda-screen";
import { parseAgendaView, type AgendaView } from "@/src/modules/appointments/agenda-navigation";

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

export async function updateAppointmentDetailsAction(formData: FormData) {
  const { userId: changedById } = await requireStaff();
  let feedback: InternalFeedbackCode;
  try {
    const result = await appointmentDetails.updateAppointmentDetails({
      appointmentId: formString(formData, "appointmentId"),
      expectedCustomerUpdatedAt: formString(formData, "expectedCustomerUpdatedAt"),
      expectedAppointmentUpdatedAt: formString(formData, "expectedAppointmentUpdatedAt"),
      expectedCustomerDetailVersion: formString(formData, "expectedCustomerDetailVersion"),
      expectedAppointmentDetailVersion: formString(formData, "expectedAppointmentDetailVersion"),
      fullName: formString(formData, "fullName"),
      phone: formString(formData, "phone"),
      email: formString(formData, "email"),
      notes: formString(formData, "notes"),
      changedById,
    });
    feedback = {
      UPDATED: "details-updated",
      UNCHANGED: "details-unchanged",
      NOT_FOUND: "appointment-not-found",
      STALE: "details-stale",
      PHONE_IN_USE: "details-phone-in-use",
      INVALID_PHONE: "details-invalid",
    }[result.status] as InternalFeedbackCode;
    if (result.status === "UPDATED") revalidatePath("/internal");
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    feedback = "details-invalid";
  }
  redirect(agendaUrl(formString(formData, "date"), feedback, parseAgendaView(formString(formData, "view"))));
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

export async function signOutAction() {
  await signOut({ redirectTo: "/internal/login" });
}
