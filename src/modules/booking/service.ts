import { randomBytes } from "node:crypto";
import { z } from "zod";
import { formatWorkshopDateTime, workshopInstant } from "@/src/lib/workshop-date";
import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";
import { customerSchema, vehicleSchema } from "@/src/modules/customers/schemas";
import { getAvailableSlots, type AvailableSlot } from "@/src/modules/availability";
import { calendarDateSchema } from "@/src/modules/settings/business-settings";
import type { EmailNotificationDraft } from "@/src/modules/notifications/service";
import type { ScheduleBreak, ScheduleDateException, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

export type PublicVehicleTypeRecord = {
  id: string;
  name: string;
};

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
  serviceDurationMinutes: number;
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
  listActiveVehicleTypes(): Promise<PublicVehicleTypeRecord[]>;
  /**
   * Appointments overlapping the date. `excludeLapsedDepositHolds` leaves out reservations whose
   * deposit deadline passed unpaid: a read-only view can already offer that time, while the booking
   * itself, after the overdue holds are settled, still counts anything left pending.
   */
  findAppointmentsForDate(date: string, options?: { excludeLapsedDepositHolds?: boolean }): Promise<PublicAppointmentRecord[]>;
  /** Runs `operation` against a repository bound to one serializable transaction. */
  withBookingTransaction<T>(operation: (repository: BookingRepository) => Promise<T>): Promise<T>;
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
    vehicle: z.infer<typeof vehicleSchema>;
    notes?: string;
    /** Queued in the email outbox by the same write that creates the appointment. */
    notification?: EmailNotificationDraft;
  }): Promise<PublicAppointmentRecord>;
  findCancellableAppointment(appointmentId: string, token: string): Promise<PublicAppointmentRecord | null>;
  /**
   * Cancels only if the appointment is still in `fromStatus`; returns false when another change got
   * there first, so a cancellation is never validated against a stale status.
   */
  cancelAppointment(appointmentId: string, fromStatus: AppointmentStatus): Promise<boolean>;
};

const bookingInputSchema = z.object({
  serviceId: z.string().trim().min(1),
  date: calendarDateSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/u),
  durationMinutes: z.number().int().positive().optional(),
  customer: customerSchema,
  vehicle: vehicleSchema,
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
      depositRequired: boolean;
      /** True when the idempotency key matched an earlier request and nothing new was created. */
      repeated: boolean;
    }
  | {
      accepted: false;
      reason: "VALIDATION_FAILED" | "SERVICE_UNAVAILABLE" | "SLOT_UNAVAILABLE";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type PublicAppointmentStatusResult =
  | {
      accepted: true;
      appointment: Pick<
        PublicAppointmentRecord,
        "publicCode" | "serviceName" | "serviceDurationMinutes" | "startAt" | "endAt" | "status"
      >;
    }
  | { accepted: false; reason: "APPOINTMENT_NOT_FOUND"; message: string };

const publicCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{10}$/u);

export async function listPublicServices(repository: BookingRepository): Promise<PublicServiceRecord[]> {
  return repository.listActiveServices();
}

export async function getPublicDepositPolicy(repository: BookingRepository): Promise<{
  required: boolean;
  amountCents: number;
  expirationMinutes: number;
}> {
  const { settings } = await repository.getBookingContext();
  return {
    required: settings.depositRequired,
    amountCents: settings.depositAmountCents,
    expirationMinutes: settings.depositExpirationMinutes,
  };
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
    repository.findAppointmentsForDate(input.date, { excludeLapsedDepositHolds: true }),
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
    return { accepted: false, reason: "APPOINTMENT_NOT_FOUND", message: "No encontramos un turno con ese código." };
  }

  return {
    accepted: true,
    appointment: {
      publicCode: appointment.publicCode,
      serviceName: appointment.serviceName,
      serviceDurationMinutes: appointment.serviceDurationMinutes,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
    },
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
      message: "Revisá los datos del cliente y del vehículo.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  return repository.withBookingTransaction(async (tx): Promise<CreatePublicBookingResult> => {
    const context = await tx.getBookingContext();
    const existing = await tx.findByIdempotencyKey(parsed.data.idempotencyKey);
    if (existing) {
      return bookingSuccess(existing, existing.cancellationToken, {
        repeated: true,
        rawTokenRecoverable: existing.cancellationToken !== null,
        depositRequired: context.settings.depositRequired,
      });
    }

    const service = await tx.findActiveService(parsed.data.serviceId);
    if (!service) {
      return { accepted: false, reason: "SERVICE_UNAVAILABLE", message: "Elegí un servicio activo." };
    }

    const durationMinutes = effectiveDurationMinutes(
      service.durationMinutes,
      parsed.data.durationMinutes,
      context.settings.slotStepMinutes,
    );
    if (durationMinutes === null) {
      return {
        accepted: false,
        reason: "VALIDATION_FAILED",
        message: "Elegí una duración válida para el servicio.",
        fieldErrors: { durationMinutes: ["La duración debe respetar el mínimo del servicio y el paso del taller."] },
      };
    }
    const startAt = workshopInstant(parsed.data.date, parsed.data.startTime);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const available = getAvailableSlots({
      settings: context.settings,
      schedules: context.schedules,
      breaks: context.breaks,
      exceptions: context.exceptions,
      date: parsed.data.date,
      serviceDurationMinutes: durationMinutes,
      appointments: await tx.findAppointmentsForDate(parsed.data.date),
      now: parsed.data.now,
    }).some((slot) => slot.startAt.getTime() === startAt.getTime() && slot.endAt.getTime() === endAt.getTime());

    if (!available) {
      return { accepted: false, reason: "SLOT_UNAVAILABLE", message: "Elegí otro horario disponible." };
    }

    const cancellationToken = context.settings.cancellationEnabled ? createCancellationToken() : null;
    const status = !context.settings.depositRequired && context.settings.confirmationMode === "AUTOMATIC"
      ? "CONFIRMED"
      : "PENDING_CONFIRMATION";
    const publicCode = createPublicCode();
    const recipient = parsed.data.customer.email;
    const appointment = await tx.createAppointment({
      publicCode,
      service,
      startAt,
      endAt,
      idempotencyKey: parsed.data.idempotencyKey,
      cancellationToken,
      status,
      customer: parsed.data.customer,
      vehicle: parsed.data.vehicle,
      notes: parsed.data.notes,
      notification: recipient
        ? {
            event: "PUBLIC_BOOKING_CREATED",
            recipient,
            subject: "Recibimos tu turno",
            text: `Recibimos tu turno para ${service.name} el ${formatDateTime(startAt)}. Código: ${publicCode}.`,
          }
        : undefined,
    });

    return bookingSuccess(appointment, cancellationToken, { depositRequired: context.settings.depositRequired });
  });
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

  if (!(await repository.cancelAppointment(appointment.id, appointment.status))) {
    return {
      accepted: false,
      reason: "CANCELLATION_UNAVAILABLE",
      message: "Este turno no se puede cancelar online.",
    };
  }
  return { accepted: true, message: "Tu turno fue cancelado.", reschedulingAvailable: false };
}

function bookingSuccess(
  appointment: PublicAppointmentRecord,
  cancellationToken: string | null,
  options: { repeated?: boolean; rawTokenRecoverable?: boolean; depositRequired?: boolean } = {},
): Extract<CreatePublicBookingResult, { accepted: true }> {
  const repeatedWithoutToken = options.repeated && !options.rawTokenRecoverable;
  return {
    accepted: true,
    message: repeatedWithoutToken
      ? "Este pedido de turno ya fue recibido. Usá el mensaje original para acceder al enlace de cancelación."
      : appointment.status === "CONFIRMED"
        ? "Tu turno quedó confirmado automáticamente."
        : "Recibimos tu pedido de turno y queda pendiente de confirmación del taller.",
    appointment,
    cancellationToken,
    reschedulingAvailable: false,
    depositRequired: options.depositRequired ?? false,
    repeated: options.repeated ?? false,
  };
}

function createCancellationToken(): string {
  return randomBytes(16).toString("hex");
}

function createPublicCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return [...randomBytes(10)].map((value) => alphabet[value & 31]).join("");
}

function formatDateTime(date: Date): string {
  return formatWorkshopDateTime(date, { dateStyle: "short", timeStyle: "short" });
}
