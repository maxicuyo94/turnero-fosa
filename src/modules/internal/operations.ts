import { z } from "zod";
import { type AppointmentStatus, appointmentStatusSchema } from "@/src/modules/appointments/schemas";

export type InternalAppointmentRecord = {
  id: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
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
  updateAppointmentStatus(input: {
    appointmentId: string;
    nextStatus: AppointmentStatus;
    changedById: string | null;
    note?: string;
  }): Promise<InternalAppointmentRecord>;
};

const agendaInputSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) });
const updateStatusInputSchema = z.object({
  appointmentId: z.string().trim().min(1),
  nextStatus: appointmentStatusSchema,
  changedById: z.string().trim().min(1).nullable(),
  note: z.string().trim().max(1_000).optional(),
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

  return { accepted: true, appointment: await repository.updateAppointmentStatus(parsed) };
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
