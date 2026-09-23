import { z } from "zod";
import { formatWorkshopDateTime, workshopDayBounds, workshopTime } from "@/src/lib/workshop-date";
import { type AppointmentStatus, appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import {
  getInternalAvailableSlots,
  validateAppointmentInterval,
  type AppointmentIntervalRejection,
} from "@/src/modules/availability";
import type { EmailNotificationDraft } from "@/src/modules/notifications/service";
import type { ScheduleBreak, ScheduleDateException, WeeklySchedule } from "@/src/modules/settings/schemas";

export type InternalAppointmentIntervalHistory = {
  id: string;
  previousStartAt: Date;
  previousEndAt: Date;
  newStartAt: Date;
  newEndAt: Date;
  changedAt: Date;
  changedByName: string | null;
  reason: string | null;
};

export type InternalAppointmentRecord = {
  id: string;
  publicCode: string;
  serviceName: string;
  serviceDurationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleId: string;
  vehicleLabel: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  intervalHistory: InternalAppointmentIntervalHistory[];
};

export type InternalSchedulingRepository = {
  /** Runs `operation` against a repository bound to one serializable transaction. */
  withSchedulingTransaction<T>(operation: (repository: InternalSchedulingRepository) => Promise<T>): Promise<T>;
  findAppointmentById(appointmentId: string): Promise<InternalAppointmentRecord | null>;
  listAppointmentsForDate(date: string): Promise<InternalAppointmentRecord[]>;
  getSchedulingContext(): Promise<{
    settings: { capacity: number; slotStepMinutes: number };
    schedules: WeeklySchedule[];
    breaks: ScheduleBreak[];
    exceptions: ScheduleDateException[];
  }>;
  updateAppointmentInterval(input: {
    appointmentId: string;
    startAt: Date;
    endAt: Date;
    changedById: string | null;
    reason?: string;
    /** Queued in the email outbox by the same write that moves the appointment. */
    notification?: EmailNotificationDraft;
  }): Promise<InternalAppointmentRecord>;
};

export type InternalAgenda = {
  date: string;
  appointments: InternalAppointmentRecord[];
};

export type InternalOperationsRepository = {
  listAppointmentsForDate(date: string): Promise<InternalAppointmentRecord[]>;
  /** Appointments overlapping the workshop days `fromDate`..`toDate`, both included, by start time. */
  listAppointmentsBetween(fromDate: string, toDate: string): Promise<InternalAppointmentRecord[]>;
  findAppointmentById(appointmentId: string): Promise<InternalAppointmentRecord | null>;
  /**
   * Applies the change only if the appointment is still in `fromStatus`; returns null when another
   * change got there first, so a transition is never validated against a stale status.
   */
  updateAppointmentStatus(input: {
    appointmentId: string;
    fromStatus: AppointmentStatus;
    nextStatus: AppointmentStatus;
    changedById: string | null;
    note?: string;
    /** Queued in the email outbox by the same write that changes the status. */
    notification?: EmailNotificationDraft;
  }): Promise<InternalAppointmentRecord | null>;
};

const agendaInputSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) });
const updateStatusInputSchema = z.object({
  appointmentId: z.string().trim().min(1),
  nextStatus: appointmentStatusSchema,
  changedById: z.string().trim().min(1).nullable(),
  note: z.string().trim().max(1_000).optional(),
});
const rescheduleInputSchema = z.object({
  appointmentId: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
  durationMinutes: z.coerce.number().int().positive(),
  changedById: z.string().trim().min(1).nullable(),
  reason: z.string().trim().max(1_000).optional(),
});
const previewIntervalInputSchema = rescheduleInputSchema.pick({
  appointmentId: true,
  date: true,
  durationMinutes: true,
});

const validTransitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Statuses staff may move an appointment to; the agenda offers exactly these. */
export function allowedNextStatuses(status: AppointmentStatus): readonly AppointmentStatus[] {
  return validTransitions[status];
}

/** Finished appointments accept neither status changes nor rescheduling. */
export function isTerminalStatus(status: AppointmentStatus): boolean {
  return validTransitions[status].length === 0;
}

export async function getInternalAgenda(repository: InternalOperationsRepository, input: { date: string }): Promise<InternalAgenda> {
  const parsed = agendaInputSchema.parse(input);
  return { date: parsed.date, appointments: await repository.listAppointmentsForDate(parsed.date) };
}

/** One agenda per date from a single query, instead of one query per day of the week. */
export async function getInternalAgendas(
  repository: InternalOperationsRepository,
  input: { dates: string[] },
): Promise<InternalAgenda[]> {
  const dates = input.dates.map((date) => agendaInputSchema.parse({ date }).date).sort();
  if (dates.length === 0) return [];

  const appointments = await repository.listAppointmentsBetween(dates[0]!, dates[dates.length - 1]!);
  return dates.map((date) => {
    const { start, end } = workshopDayBounds(date);
    return { date, appointments: appointments.filter((item) => item.startAt < end && item.endAt > start) };
  });
}

export async function updateInternalAppointmentStatus(
  repository: InternalOperationsRepository,
  input: z.input<typeof updateStatusInputSchema>,
): Promise<
  | { accepted: true; appointment: InternalAppointmentRecord }
  | { accepted: false; reason: "APPOINTMENT_NOT_FOUND" | "INVALID_TRANSITION"; message: string }
> {
  const parsed = updateStatusInputSchema.parse(input);
  const appointment = await repository.findAppointmentById(parsed.appointmentId);
  if (!appointment) return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No se encontró el turno." };
  if (!validTransitions[appointment.status].includes(parsed.nextStatus)) {
    return {
      accepted: false,
      reason: "INVALID_TRANSITION",
      message: `No se puede cambiar un turno de ${statusLabel(appointment.status)} a ${statusLabel(parsed.nextStatus)}.`,
    };
  }

  const updated = await repository.updateAppointmentStatus({
    ...parsed,
    fromStatus: appointment.status,
    notification: appointment.customerEmail
      ? {
          event: "APPOINTMENT_STATUS_CHANGED",
          recipient: appointment.customerEmail,
          subject: "Actualización de tu turno",
          text: `Tu turno para ${appointment.serviceName} ahora está ${statusLabel(parsed.nextStatus)}.`,
        }
      : undefined,
  });
  if (!updated) {
    return {
      accepted: false,
      reason: "INVALID_TRANSITION",
      message: "El turno cambió de estado mientras lo editabas. Recargá la agenda e intentá de nuevo.",
    };
  }

  return { accepted: true, appointment: updated };
}

export async function rescheduleInternalAppointment(
  repository: InternalSchedulingRepository,
  input: z.input<typeof rescheduleInputSchema>,
): Promise<
  | { accepted: true; appointment: InternalAppointmentRecord }
  | {
      accepted: false;
      reason: "APPOINTMENT_NOT_FOUND" | "TERMINAL_APPOINTMENT" | AppointmentIntervalRejection;
      message: string;
    }
> {
  const parsed = rescheduleInputSchema.parse(input);
  return repository.withSchedulingTransaction(async (tx) => {
    const appointment = await tx.findAppointmentById(parsed.appointmentId);
    if (!appointment) {
      return { accepted: false as const, reason: "APPOINTMENT_NOT_FOUND" as const, message: "No se encontró el turno." };
    }
    if (isTerminalStatus(appointment.status)) {
      return { accepted: false as const, reason: "TERMINAL_APPOINTMENT" as const, message: "No se puede reprogramar un turno finalizado." };
    }

    // Sequential on purpose: a transaction's connection must not run concurrent queries.
    const context = await tx.getSchedulingContext();
    const appointments = await tx.listAppointmentsForDate(parsed.date);
    const validation = validateAppointmentInterval({
      ...context,
      date: parsed.date,
      startTime: parsed.startTime,
      durationMinutes: parsed.durationMinutes,
      serviceMinimumDurationMinutes: appointment.serviceDurationMinutes,
      appointments,
      excludeAppointmentId: appointment.id,
    });
    if (!validation.accepted) {
      return { accepted: false as const, reason: validation.reason, message: intervalRejectionMessage(validation.reason) };
    }

    return {
      accepted: true as const,
      appointment: await tx.updateAppointmentInterval({
        appointmentId: appointment.id,
        startAt: validation.startAt,
        endAt: validation.endAt,
        changedById: parsed.changedById,
        reason: parsed.reason,
        notification: appointment.customerEmail
          ? {
              event: "APPOINTMENT_INTERVAL_CHANGED",
              recipient: appointment.customerEmail,
              subject: "Actualización de tu turno",
              text: `Tu turno para ${appointment.serviceName} fue reprogramado para ${formatDateTime(validation.startAt)} hasta ${formatTime(validation.endAt)}.`,
            }
          : undefined,
      }),
    };
  });
}

export async function previewInternalAppointmentSlots(
  repository: InternalSchedulingRepository,
  input: z.input<typeof previewIntervalInputSchema>,
): Promise<
  | { accepted: true; slots: Array<{ startTime: string; endTime: string; remainingCapacity: number }> }
  | {
      accepted: false;
      reason: "APPOINTMENT_NOT_FOUND" | "TERMINAL_APPOINTMENT" | "INVALID_DURATION";
      message: string;
    }
> {
  const parsed = previewIntervalInputSchema.parse(input);
  const appointment = await repository.findAppointmentById(parsed.appointmentId);
  if (!appointment) {
    return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No se encontró el turno." };
  }
  if (isTerminalStatus(appointment.status)) {
    return {
      accepted: false,
      reason: "TERMINAL_APPOINTMENT",
      message: "No se puede reprogramar un turno finalizado.",
    };
  }

  const [context, appointments] = await Promise.all([
    repository.getSchedulingContext(),
    repository.listAppointmentsForDate(parsed.date),
  ]);
  if (
    parsed.durationMinutes < appointment.serviceDurationMinutes ||
    parsed.durationMinutes % context.settings.slotStepMinutes !== 0
  ) {
    return {
      accepted: false,
      reason: "INVALID_DURATION",
      message: intervalRejectionMessage("INVALID_DURATION"),
    };
  }

  const slots = getInternalAvailableSlots({
    ...context,
    date: parsed.date,
    durationMinutes: parsed.durationMinutes,
    serviceMinimumDurationMinutes: appointment.serviceDurationMinutes,
    appointments,
    excludeAppointmentId: appointment.id,
  });

  return {
    accepted: true,
    slots: slots.map((slot) => ({
      startTime: slot.startTime,
      endTime: formatTime(slot.endAt),
      remainingCapacity: slot.remainingCapacity,
    })),
  };
}

export function statusLabel(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    PENDING_CONFIRMATION: "pendiente",
    CONFIRMED: "confirmado",
    IN_PROGRESS: "en curso",
    COMPLETED: "completado",
    CANCELLED: "cancelado",
    NO_SHOW: "ausente",
  };
  return labels[status];
}

export const internalStatusOptions = appointmentStatusSchema.options;

export function intervalRejectionMessage(reason: AppointmentIntervalRejection): string {
  const messages: Record<AppointmentIntervalRejection, string> = {
    INVALID_DURATION: "La duración no respeta el mínimo del servicio o el paso del taller.",
    CLOSED_DATE: "El taller está cerrado en la fecha seleccionada.",
    OUTSIDE_OPENING_HOURS: "El turno debe quedar completamente dentro del horario de apertura.",
    BREAK_OVERLAP: "El turno se superpone con un descanso del taller.",
    DAY_BOUNDARY_EXCEEDED: "El turno debe terminar en el mismo día.",
    CAPACITY_EXHAUSTED: "No hay capacidad disponible para todo el intervalo seleccionado.",
  };
  return messages[reason];
}

function formatDateTime(date: Date): string {
  return formatWorkshopDateTime(date, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

const formatTime = workshopTime;
