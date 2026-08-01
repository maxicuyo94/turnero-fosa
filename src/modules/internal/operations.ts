import { z } from "zod";
import { type AppointmentStatus, appointmentStatusSchema } from "@/src/modules/appointments/schemas";
import { sendEmailAndLog, type NotificationLogRepository, type NotificationPort } from "@/src/modules/notifications/service";

export type InternalAppointmentRecord = {
  id: string;
  publicCode: string;
  serviceName: string;
  serviceDurationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  motorcycleLabel: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  notes: string | null;
};

export type InternalAgenda = {
  date: string;
  appointments: InternalAppointmentRecord[];
};

export type InternalOperationsRepository = {
  listAppointmentsForDate(date: string): Promise<InternalAppointmentRecord[]>;
  findAppointmentById(appointmentId: string): Promise<InternalAppointmentRecord | null>;
  getSlotStepMinutes(): Promise<number>;
  updateAppointmentEnd(input: { appointmentId: string; endAt: Date }): Promise<InternalAppointmentRecord>;
  updateAppointmentStatus(input: {
    appointmentId: string;
    nextStatus: AppointmentStatus;
    changedById: string | null;
    note?: string;
  }): Promise<InternalAppointmentRecord>;
};

export type InternalStatusNotificationOptions = {
  logRepository: NotificationLogRepository;
  port: NotificationPort;
};

const agendaInputSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) });
const updateStatusInputSchema = z.object({
  appointmentId: z.string().trim().min(1),
  nextStatus: appointmentStatusSchema,
  changedById: z.string().trim().min(1).nullable(),
  note: z.string().trim().max(1_000).optional(),
});
const updateDurationInputSchema = z.object({
  appointmentId: z.string().trim().min(1),
  durationMinutes: z.coerce.number().int().positive(),
});

const validTransitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function getInternalAgenda(repository: InternalOperationsRepository, input: { date: string }): Promise<InternalAgenda> {
  const parsed = agendaInputSchema.parse(input);
  return { date: parsed.date, appointments: await repository.listAppointmentsForDate(parsed.date) };
}

export async function updateInternalAppointmentStatus(
  repository: InternalOperationsRepository,
  input: z.input<typeof updateStatusInputSchema>,
  notifications?: InternalStatusNotificationOptions,
): Promise<
  | { accepted: true; appointment: InternalAppointmentRecord }
  | { accepted: false; reason: "APPOINTMENT_NOT_FOUND" | "INVALID_TRANSITION"; message: string }
> {
  const parsed = updateStatusInputSchema.parse(input);
  const appointment = await repository.findAppointmentById(parsed.appointmentId);
  if (!appointment) return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No se encontro el turno." };
  if (!validTransitions[appointment.status].includes(parsed.nextStatus)) {
    return {
      accepted: false,
      reason: "INVALID_TRANSITION",
      message: `No se puede cambiar un turno de ${statusLabel(appointment.status)} a ${statusLabel(parsed.nextStatus)}.`,
    };
  }

  const updated = await repository.updateAppointmentStatus(parsed);
  if (updated.customerEmail && notifications) {
    await sendEmailAndLog(notifications.logRepository, notifications.port, {
      event: "APPOINTMENT_STATUS_CHANGED",
      appointmentId: updated.id,
      recipient: updated.customerEmail,
      subject: "Actualizacion de tu turno",
      text: `Tu turno para ${updated.serviceName} ahora esta ${statusLabel(updated.status)}.`,
    });
  }

  return { accepted: true, appointment: updated };
}

export async function updateInternalAppointmentDuration(
  repository: InternalOperationsRepository,
  input: z.input<typeof updateDurationInputSchema>,
): Promise<
  | { accepted: true; appointment: InternalAppointmentRecord }
  | {
      accepted: false;
      reason: "APPOINTMENT_NOT_FOUND" | "INVALID_DURATION" | "DURATION_NOT_EXTENDED" | "TERMINAL_APPOINTMENT" | "DAY_BOUNDARY_EXCEEDED";
      message: string;
    }
> {
  const parsed = updateDurationInputSchema.parse(input);
  const appointment = await repository.findAppointmentById(parsed.appointmentId);
  if (!appointment) return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No se encontro el turno." };
  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    return { accepted: false, reason: "TERMINAL_APPOINTMENT", message: "No se puede extender un turno finalizado." };
  }

  const currentDurationMinutes = (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000;
  if (parsed.durationMinutes <= currentDurationMinutes) {
    return { accepted: false, reason: "DURATION_NOT_EXTENDED", message: "La nueva duracion debe ser mayor que la actual." };
  }

  const slotStepMinutes = await repository.getSlotStepMinutes();
  if (parsed.durationMinutes < appointment.serviceDurationMinutes || parsed.durationMinutes % slotStepMinutes !== 0) {
    return { accepted: false, reason: "INVALID_DURATION", message: "La duracion no respeta el minimo o el paso del taller." };
  }

  const endAt = new Date(appointment.startAt.getTime() + parsed.durationMinutes * 60_000);
  if (localDate(appointment.startAt) !== localDate(endAt)) {
    return { accepted: false, reason: "DAY_BOUNDARY_EXCEEDED", message: "La extension debe terminar en el mismo dia." };
  }

  return { accepted: true, appointment: await repository.updateAppointmentEnd({ appointmentId: appointment.id, endAt }) };
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

function localDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}
