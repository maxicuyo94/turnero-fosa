import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { BookingRepository, PublicAppointmentRecord, PublicServiceRecord } from "@/src/modules/booking/service";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import { mapScheduleDateException } from "@/src/modules/settings/date-exceptions";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export class PrismaBookingRepository implements BookingRepository {
  private tx?: TransactionClient;

  constructor(private readonly prisma: PrismaClient, tx?: TransactionClient) {
    this.tx = tx;
  }

  private get client(): PrismaClient | TransactionClient {
    return this.tx ?? this.prisma;
  }

  async getBookingContext() {
    const settings = await this.client.workshopSettings.findFirst({
      orderBy: { createdAt: "asc" },
      include: { weeklySchedules: true, scheduleBreaks: true, dateExceptions: true },
    });
    if (!settings) throw new Error("Workshop settings are not seeded.");

    return {
      settings: {
        workshopName: settings.workshopName,
        capacity: settings.capacity,
        slotStepMinutes: settings.slotStepMinutes,
        minimumNoticeMinutes: settings.minimumNoticeMinutes,
        maximumBookingWindowDays: settings.maximumBookingWindowDays,
        confirmationMode: settings.confirmationMode,
        cancellationEnabled: settings.cancellationEnabled,
        reschedulingEnabled: settings.reschedulingEnabled,
      },
      schedules: settings.weeklySchedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        opensAt: schedule.opensAt,
        closesAt: schedule.closesAt,
        isOpen: schedule.isOpen,
      })),
      breaks: settings.scheduleBreaks.map((scheduleBreak) => ({
        dayOfWeek: scheduleBreak.dayOfWeek,
        startsAt: scheduleBreak.startsAt,
        endsAt: scheduleBreak.endsAt,
      })),
      exceptions: settings.dateExceptions.map(mapScheduleDateException),
    };
  }

  async listActiveServices(): Promise<PublicServiceRecord[]> {
    const services = await this.client.service.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
    return services.map(mapService);
  }

  async findActiveService(serviceId: string): Promise<PublicServiceRecord | null> {
    const service = await this.client.service.findFirst({ where: { id: serviceId, isActive: true } });
    return service ? mapService(service) : null;
  }

  async findAppointmentsForDate(date: string): Promise<PublicAppointmentRecord[]> {
    const startOfDay = new Date(`${date}T00:00:00-03:00`);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const appointments = await this.client.appointment.findMany({
      where: { startAt: { lt: endOfDay }, endAt: { gt: startOfDay } },
      include: { service: true },
    });
    return appointments.map(mapAppointment);
  }

  async withBookingTransaction<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const previous = this.tx;
            this.tx = tx;
            try {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('public_booking_capacity'))`;
              return await operation();
            } finally {
              this.tx = previous;
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableTransactionError(error) || attempt === 3) throw error;
      }
    }

    throw new Error("Booking transaction retry attempts exhausted.");
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PublicAppointmentRecord | null> {
    const appointment = await this.client.appointment.findUnique({ where: { idempotencyKey }, include: { service: true } });
    return appointment ? mapAppointment(appointment) : null;
  }

  async findByPublicCode(publicCode: string): Promise<PublicAppointmentRecord | null> {
    const appointment = await this.client.appointment.findUnique({ where: { publicCode }, include: { service: true } });
    return appointment ? mapAppointment(appointment) : null;
  }

  async createAppointment(input: Parameters<BookingRepository["createAppointment"]>[0]): Promise<PublicAppointmentRecord> {
    const customer = await this.client.customer.create({
      data: { fullName: input.customer.fullName, phone: input.customer.phone, email: input.customer.email },
    });
    const motorcycle = await this.client.motorcycle.create({
      data: {
        customerId: customer.id,
        brand: input.motorcycle.brand,
        model: input.motorcycle.model,
        licensePlate: input.motorcycle.licensePlate,
        year: input.motorcycle.year,
      },
    });

    const appointment = await this.client.appointment.create({
      data: {
        publicCode: input.publicCode,
        serviceId: input.service.id,
        customerId: customer.id,
        motorcycleId: motorcycle.id,
        startAt: input.startAt,
        endAt: input.endAt,
        status: input.status,
        idempotencyKey: input.idempotencyKey,
        cancellationTokenHash: input.cancellationToken ? hashCancellationToken(input.cancellationToken) : null,
        notes: input.notes,
        statusHistory: { create: { toStatus: input.status, note: "Public booking request created." } },
      },
      include: { service: true },
    });

    return { ...mapAppointment(appointment), cancellationToken: input.cancellationToken };
  }

  async findCancellableAppointment(appointmentId: string, token: string): Promise<PublicAppointmentRecord | null> {
    const appointment = await this.client.appointment.findFirst({
      where: { id: appointmentId, cancellationTokenHash: hashCancellationToken(token) },
      include: { service: true },
    });
    return appointment ? mapAppointment(appointment) : null;
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    await this.client.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        statusHistory: { create: { toStatus: "CANCELLED", note: "Cancelled by public token." } },
      },
    });
  }
}

function hashCancellationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}

function mapService(service: { id: string; name: string; description: string | null; durationMinutes: number; isActive: boolean; displayOrder: number }) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    displayOrder: service.displayOrder,
  };
}

function mapAppointment(appointment: {
  id: string;
  publicCode: string;
  serviceId: string;
  service: { name: string; durationMinutes: number };
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  idempotencyKey: string;
  cancellationTokenHash: string | null;
}): PublicAppointmentRecord {
  return {
    id: appointment.id,
    publicCode: appointment.publicCode,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    serviceDurationMinutes: appointment.service.durationMinutes,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    idempotencyKey: appointment.idempotencyKey,
    cancellationToken: null,
  };
}
