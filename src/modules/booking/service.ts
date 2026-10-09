import { randomBytes } from "node:crypto";
import { z } from "zod";
import { formatWorkshopDateTime, workshopDate, workshopInstant } from "@/src/lib/workshop-date";
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
    /**
     * Built from the created appointment (its links need the id) and queued in the email outbox in
     * the same transaction that creates it.
     */
    notification?: (appointment: { id: string }) => EmailNotificationDraft;
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
  /** Origin the confirmation email links back to; without it the email carries only the code. */
  publicOrigin: z.string().url().optional(),
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

/** One context per search; closed dates need no appointment query. Always revalidated on booking. */
export async function findNextPublicAvailability(
  repository: BookingRepository,
  input: { serviceId: string; fromDate: string; durationMinutes?: number; now: Date },
): Promise<{ date: string; startTime: string } | null> {
  if (!calendarDateSchema.safeParse(input.fromDate).success) return null;
  const [context, service] = await Promise.all([repository.getBookingContext(), repository.findActiveService(input.serviceId)]);
  if (!service) return null;
  const durationMinutes = effectiveDurationMinutes(service.durationMinutes, input.durationMinutes, context.settings.slotStepMinutes);
  if (durationMinutes === null) return null;
  const today = workshopDate(input.now);
  const lastDate = workshopDate(new Date(workshopInstant(today).getTime() + context.settings.maximumBookingWindowDays * 86_400_000));
  for (let date = input.fromDate > today ? input.fromDate : today; date <= lastDate;
    date = workshopDate(new Date(workshopInstant(date).getTime() + 86_400_000))) {
    const base = { ...context, date, serviceDurationMinutes: durationMinutes, now: input.now };
    if (!getAvailableSlots({ ...base, appointments: [] }).length) continue;
    const appointments = await repository.findAppointmentsForDate(date, { excludeLapsedDepositHolds: true });
    const first = getAvailableSlots({ ...base, appointments })[0];
    if (first) return { date, startTime: first.startTime };
  }
  return null;
}

/** The secret link must be validated before exposing even the service or date. */
export async function getPublicCancellationPreview(
  repository: BookingRepository,
  input: { appointmentId: string; token: string; now: Date },
): Promise<{ appointment: PublicAppointmentRecord; canCancel: boolean } | null> {
  if (!input.appointmentId || !/^[a-f0-9]{32}$/u.test(input.token)) return null;
  const appointment = await repository.findCancellableAppointment(input.appointmentId, input.token);
  if (!appointment) return null;
  const { settings } = await repository.getBookingContext();
  return { appointment, canCancel: settings.cancellationEnabled && countsTowardCapacity(appointment.status) && appointment.startAt > input.now };
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
        ? (created) => ({
            event: "PUBLIC_BOOKING_CREATED",
            recipient,
            subject: "Recibimos tu turno",
            text: bookingConfirmationText({
              serviceName: service.name,
              startAt,
              publicCode,
              appointmentId: created.id,
              cancellationToken,
              publicOrigin: parsed.data.publicOrigin,
            }),
          })
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
      ? "Este pedido de turno ya fue recibido. Si dejaste tu email, ahí tenés el código y los enlaces del turno."
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

/**
 * The email is the only lasting copy of the cancellation link: the confirmation page shows it once
 * and the token is stored hashed, so it cannot be recovered later.
 */
function bookingConfirmationText(input: {
  serviceName: string;
  startAt: Date;
  publicCode: string;
  appointmentId: string;
  cancellationToken: string | null;
  publicOrigin?: string;
}): string {
  const lines = [`Recibimos tu turno para ${input.serviceName} el ${formatDateTime(input.startAt)}. Código: ${input.publicCode}.`];
  if (input.publicOrigin) {
    const statusUrl = new URL("/booking/status", input.publicOrigin);
    statusUrl.searchParams.set("code", input.publicCode);
    lines.push("", `Consultá el estado: ${statusUrl.toString()}`);
    if (input.cancellationToken) {
      const cancelUrl = new URL("/booking/cancel", input.publicOrigin);
      cancelUrl.searchParams.set("appointmentId", input.appointmentId);
      cancelUrl.searchParams.set("token", input.cancellationToken);
      lines.push(`Si necesitás cancelarlo: ${cancelUrl.toString()}`);
    }
  }
  return lines.join("\n");
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
