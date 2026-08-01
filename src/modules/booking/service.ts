import { randomBytes } from "node:crypto";
import { z } from "zod";
import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";
import { customerSchema, motorcycleSchema } from "@/src/modules/customers/schemas";
import { getAvailableSlots, type AvailableSlot } from "@/src/modules/availability";
import { sendEmailAndLog, type NotificationLogRepository, type NotificationPort } from "@/src/modules/notifications/service";
import type { ScheduleBreak, ScheduleDateException, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

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
  publicCode: string;
  serviceId: string;
  serviceName: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  idempotencyKey: string;
  cancellationToken: string | null;
};

export type BookingRepository = {
  getBookingContext(): Promise<{
    settings: WorkshopSettings;
    schedules: WeeklySchedule[];
    breaks: ScheduleBreak[];
    exceptions: ScheduleDateException[];
  }>;
  listActiveServices(): Promise<PublicServiceRecord[]>;
  findActiveService(serviceId: string): Promise<PublicServiceRecord | null>;
  findAppointmentsForDate(date: string): Promise<PublicAppointmentRecord[]>;
  withBookingTransaction<T>(operation: () => Promise<T>): Promise<T>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PublicAppointmentRecord | null>;
  findByPublicCode(publicCode: string): Promise<PublicAppointmentRecord | null>;
  createAppointment(input: {
    publicCode: string;
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
  durationMinutes: z.number().int().positive().optional(),
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

export type PublicBookingNotificationOptions = {
  logRepository: NotificationLogRepository;
  port: NotificationPort;
};

export type PublicAppointmentStatusResult =
  | {
      accepted: true;
      appointment: Pick<PublicAppointmentRecord, "publicCode" | "serviceName" | "startAt" | "endAt" | "status">;
    }
  | { accepted: false; reason: "APPOINTMENT_NOT_FOUND"; message: string };

const publicCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{10}$/u);

export async function listPublicServices(repository: BookingRepository): Promise<PublicServiceRecord[]> {
  return repository.listActiveServices();
}

export async function getPublicAvailability(
  repository: BookingRepository,
  input: { serviceId: string; date: string; durationMinutes?: number; now: Date },
): Promise<
  | { accepted: true; slots: AvailableSlot[]; durationMinutes: number; slotStepMinutes: number }
  | { accepted: false; reason: "SERVICE_UNAVAILABLE" | "INVALID_DURATION"; minimumDurationMinutes?: number; slotStepMinutes?: number }
> {
  const [context, service, appointments] = await Promise.all([
    repository.getBookingContext(),
    repository.findActiveService(input.serviceId),
    repository.findAppointmentsForDate(input.date),
  ]);

  if (!service) {
    return { accepted: false, reason: "SERVICE_UNAVAILABLE" };
  }

  const durationMinutes = effectiveDurationMinutes(service.durationMinutes, input.durationMinutes, context.settings.slotStepMinutes);
  if (durationMinutes === null) {
    return {
      accepted: false,
      reason: "INVALID_DURATION",
      minimumDurationMinutes: service.durationMinutes,
      slotStepMinutes: context.settings.slotStepMinutes,
    };
  }

  return {
    accepted: true,
    durationMinutes,
    slotStepMinutes: context.settings.slotStepMinutes,
    slots: getAvailableSlots({
      settings: context.settings,
      schedules: context.schedules,
      breaks: context.breaks,
      exceptions: context.exceptions,
      date: input.date,
      serviceDurationMinutes: durationMinutes,
      appointments,
      now: input.now,
    }),
  };
}

export async function getPublicAppointmentStatus(
  repository: BookingRepository,
  input: { code: string },
): Promise<PublicAppointmentStatusResult> {
  const parsed = publicCodeSchema.safeParse(input.code);
  const appointment = parsed.success ? await repository.findByPublicCode(parsed.data) : null;
  if (!appointment) {
    return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No encontramos un turno con ese codigo." };
  }

  return {
    accepted: true,
    appointment: {
      publicCode: appointment.publicCode,
      serviceName: appointment.serviceName,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
    },
  };
}

export async function createPublicBooking(
  repository: BookingRepository,
  input: CreatePublicBookingInput,
  notifications?: PublicBookingNotificationOptions,
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

  const transactionResult = await repository.withBookingTransaction(async (): Promise<{
    result: CreatePublicBookingResult;
    notification: { appointmentId: string; publicCode: string; recipient: string; serviceName: string; startAt: Date } | null;
  }> => {
    const existing = await repository.findByIdempotencyKey(parsed.data.idempotencyKey);
    if (existing) {
      return {
        result: bookingSuccess(existing, existing.cancellationToken, {
          repeated: true,
          rawTokenRecoverable: existing.cancellationToken !== null,
        }),
        notification: null,
      };
    }

    const service = await repository.findActiveService(parsed.data.serviceId);
    if (!service) {
      return { result: { accepted: false, reason: "SERVICE_UNAVAILABLE", message: "Elegi un servicio activo." }, notification: null };
    }

    const context = await repository.getBookingContext();
    const durationMinutes = effectiveDurationMinutes(
      service.durationMinutes,
      parsed.data.durationMinutes,
      context.settings.slotStepMinutes,
    );
    if (durationMinutes === null) {
      return {
        result: {
          accepted: false,
          reason: "VALIDATION_FAILED",
          message: "Elegi una duracion valida para el servicio.",
          fieldErrors: { durationMinutes: ["La duracion debe respetar el minimo del servicio y el paso del taller."] },
        },
        notification: null,
      };
    }
    const startAt = dateAtTime(parsed.data.date, parsed.data.startTime);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const available = getAvailableSlots({
      settings: context.settings,
      schedules: context.schedules,
      breaks: context.breaks,
      exceptions: context.exceptions,
      date: parsed.data.date,
      serviceDurationMinutes: durationMinutes,
      appointments: await repository.findAppointmentsForDate(parsed.data.date),
      now: parsed.data.now,
    }).some((slot) => slot.startAt.getTime() === startAt.getTime() && slot.endAt.getTime() === endAt.getTime());

    if (!available) {
      return { result: { accepted: false, reason: "SLOT_UNAVAILABLE", message: "Elegi otro horario disponible." }, notification: null };
    }

    const cancellationToken = context.settings.cancellationEnabled ? createCancellationToken() : null;
    const status = context.settings.confirmationMode === "AUTOMATIC" ? "CONFIRMED" : "PENDING_CONFIRMATION";
    const appointment = await repository.createAppointment({
      publicCode: createPublicCode(),
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

    return {
      result: bookingSuccess(appointment, cancellationToken),
      notification: parsed.data.customer.email
        ? {
            appointmentId: appointment.id,
            publicCode: appointment.publicCode,
            recipient: parsed.data.customer.email,
            serviceName: appointment.serviceName,
            startAt: appointment.startAt,
          }
        : null,
    };
  });

  if (transactionResult.notification && notifications) {
    await sendEmailAndLog(notifications.logRepository, notifications.port, {
      event: "PUBLIC_BOOKING_CREATED",
      appointmentId: transactionResult.notification.appointmentId,
      recipient: transactionResult.notification.recipient,
      subject: "Recibimos tu turno",
      text: `Recibimos tu turno para ${transactionResult.notification.serviceName} el ${formatDateTime(transactionResult.notification.startAt)}. Codigo: ${transactionResult.notification.publicCode}.`,
    });
  }

  return transactionResult.result;
}

function effectiveDurationMinutes(serviceDurationMinutes: number, requestedDurationMinutes: number | undefined, slotStepMinutes: number): number | null {
  const durationMinutes = requestedDurationMinutes ?? serviceDurationMinutes;
  return durationMinutes >= serviceDurationMinutes && durationMinutes % slotStepMinutes === 0 ? durationMinutes : null;
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

function createPublicCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return [...randomBytes(10)].map((value) => alphabet[value & 31]).join("");
}

function dateAtTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Salta",
  }).format(date);
}
