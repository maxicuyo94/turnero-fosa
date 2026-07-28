import { randomBytes } from "node:crypto";
import { z } from "zod";
import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";
import { customerSchema, motorcycleSchema } from "@/src/modules/customers/schemas";
import { getAvailableSlots, type AvailableSlot } from "@/src/modules/availability";
import type { ScheduleBreak, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

export type PublicServiceRecord = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
};

export type PublicAppointmentRecord = {
  id: string;
  serviceId: string;
  serviceName: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  idempotencyKey: string;
  cancellationToken: string | null;
};

export type BookingRepository = {
  getBookingContext(): Promise<{ settings: WorkshopSettings; schedules: WeeklySchedule[]; breaks: ScheduleBreak[] }>;
  listActiveServices(): Promise<PublicServiceRecord[]>;
  findActiveService(serviceId: string): Promise<PublicServiceRecord | null>;
  findAppointmentsForDate(date: string): Promise<PublicAppointmentRecord[]>;
  withBookingTransaction<T>(operation: () => Promise<T>): Promise<T>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PublicAppointmentRecord | null>;
  createAppointment(input: {
    service: PublicServiceRecord;
    startAt: Date;
    endAt: Date;
    idempotencyKey: string;
    cancellationToken: string | null;
    status: AppointmentStatus;
    customer: z.infer<typeof customerSchema>;
    motorcycle: z.infer<typeof motorcycleSchema>;
    notes?: string;
  }): Promise<PublicAppointmentRecord>;
  findCancellableAppointment(appointmentId: string, token: string): Promise<PublicAppointmentRecord | null>;
  cancelAppointment(appointmentId: string): Promise<void>;
};

const bookingInputSchema = z.object({
  serviceId: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  startTime: z.string().regex(/^\d{2}:\d{2}$/u),
  customer: customerSchema,
  motorcycle: motorcycleSchema,
  idempotencyKey: z.string().trim().min(8),
  notes: z.string().trim().max(1_000).optional(),
  now: z.date(),
});

export type CreatePublicBookingInput = z.input<typeof bookingInputSchema>;

export type CreatePublicBookingResult =
  | {
      accepted: true;
      message: string;
      appointment: PublicAppointmentRecord;
      cancellationToken: string | null;
      reschedulingAvailable: false;
    }
  | {
      accepted: false;
      reason: "VALIDATION_FAILED" | "SERVICE_UNAVAILABLE" | "SLOT_UNAVAILABLE";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function listPublicServices(repository: BookingRepository): Promise<PublicServiceRecord[]> {
  return repository.listActiveServices();
}

export async function getPublicAvailability(
  repository: BookingRepository,
  input: { serviceId: string; date: string; now: Date },
): Promise<{ accepted: true; slots: AvailableSlot[] } | { accepted: false; reason: "SERVICE_UNAVAILABLE" }> {
  const [context, service, appointments] = await Promise.all([
    repository.getBookingContext(),
    repository.findActiveService(input.serviceId),
    repository.findAppointmentsForDate(input.date),
  ]);

  if (!service) {
    return { accepted: false, reason: "SERVICE_UNAVAILABLE" };
  }

  return {
    accepted: true,
    slots: getAvailableSlots({
      settings: context.settings,
      schedules: context.schedules,
      breaks: context.breaks,
      date: input.date,
      serviceDurationMinutes: service.durationMinutes,
      appointments,
      now: input.now,
    }),
  };
}

export async function createPublicBooking(
  repository: BookingRepository,
  input: CreatePublicBookingInput,
): Promise<CreatePublicBookingResult> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      accepted: false,
      reason: "VALIDATION_FAILED",
      message: "Revisa los datos del cliente y de la moto.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  return repository.withBookingTransaction(async () => {
    const existing = await repository.findByIdempotencyKey(parsed.data.idempotencyKey);
    if (existing) {
      return bookingSuccess(existing, existing.cancellationToken, {
        repeated: true,
        rawTokenRecoverable: existing.cancellationToken !== null,
      });
    }

    const service = await repository.findActiveService(parsed.data.serviceId);
    if (!service) {
      return { accepted: false, reason: "SERVICE_UNAVAILABLE", message: "Elegi un servicio activo." };
    }

    const context = await repository.getBookingContext();
    const startAt = dateAtTime(parsed.data.date, parsed.data.startTime);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    const available = getAvailableSlots({
      settings: context.settings,
      schedules: context.schedules,
      breaks: context.breaks,
      date: parsed.data.date,
      serviceDurationMinutes: service.durationMinutes,
      appointments: await repository.findAppointmentsForDate(parsed.data.date),
      now: parsed.data.now,
    }).some((slot) => slot.startAt.getTime() === startAt.getTime() && slot.endAt.getTime() === endAt.getTime());

    if (!available) {
      return { accepted: false, reason: "SLOT_UNAVAILABLE", message: "Elegi otro horario disponible." };
    }

    const cancellationToken = context.settings.cancellationEnabled ? createCancellationToken() : null;
    const status = context.settings.confirmationMode === "AUTOMATIC" ? "CONFIRMED" : "PENDING_CONFIRMATION";
    const appointment = await repository.createAppointment({
      service,
      startAt,
      endAt,
      idempotencyKey: parsed.data.idempotencyKey,
      cancellationToken,
      status,
      customer: parsed.data.customer,
      motorcycle: parsed.data.motorcycle,
      notes: parsed.data.notes,
    });

    return bookingSuccess(appointment, cancellationToken);
  });
}

export async function cancelPublicAppointment(
  repository: BookingRepository,
  input: { appointmentId: string; token: string; now: Date },
): Promise<
  | { accepted: true; message: string; reschedulingAvailable: false }
  | { accepted: false; reason: "CANCELLATION_UNAVAILABLE"; message: string }
> {
  const context = await repository.getBookingContext();
  const appointment = await repository.findCancellableAppointment(input.appointmentId, input.token);

  if (
    !context.settings.cancellationEnabled ||
    !appointment ||
    !countsTowardCapacity(appointment.status) ||
    appointment.startAt.getTime() <= input.now.getTime()
  ) {
    return {
      accepted: false,
      reason: "CANCELLATION_UNAVAILABLE",
      message: "Este turno no se puede cancelar online.",
    };
  }

  await repository.cancelAppointment(appointment.id);
  return { accepted: true, message: "Tu turno fue cancelado.", reschedulingAvailable: false };
}

function bookingSuccess(
  appointment: PublicAppointmentRecord,
  cancellationToken: string | null,
  options: { repeated?: boolean; rawTokenRecoverable?: boolean } = {},
): Extract<CreatePublicBookingResult, { accepted: true }> {
  const repeatedWithoutToken = options.repeated && !options.rawTokenRecoverable;
  return {
    accepted: true,
    message: repeatedWithoutToken
      ? "Este pedido de turno ya fue recibido. Usa el mensaje original para acceder al enlace de cancelacion."
      : appointment.status === "CONFIRMED"
        ? "Tu turno quedo confirmado automaticamente."
        : "Recibimos tu pedido de turno y queda pendiente de confirmacion del taller.",
    appointment,
    cancellationToken,
    reschedulingAvailable: false,
  };
}

function createCancellationToken(): string {
  return randomBytes(16).toString("hex");
}

function dateAtTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}
