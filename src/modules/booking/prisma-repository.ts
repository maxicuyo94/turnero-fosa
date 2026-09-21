import { createHash } from "node:crypto";
import { isDepositActive } from "@/src/modules/settings/business-settings";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { BookingRepository, PublicAppointmentRecord, PublicServiceRecord } from "@/src/modules/booking/service";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import { mapScheduleDateException } from "@/src/modules/settings/date-exceptions";
import { settleOverdueDeposits } from "@/src/modules/payments/reconciliation";
import { identityDerivedId, normalizeLicensePlate, normalizePhone } from "@/src/modules/customers/identity";

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
        depositRequired: isDepositActive(settings),
        depositAmountCents: settings.depositAmountCents,
        depositExpirationMinutes: settings.depositExpirationMinutes,
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

  async listActiveVehicleTypes() {
    const vehicleTypes = await this.client.vehicleType.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return vehicleTypes.map((vehicleType) => ({ id: vehicleType.id, name: vehicleType.name }));
  }

  async findAppointmentsForDate(date: string): Promise<PublicAppointmentRecord[]> {
    if (!this.tx) await settleOverdueDeposits(this.prisma);
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
    const customer = await this.resolveCustomer(input.customer);
    const vehicle = await this.resolveVehicle(input.vehicle, customer.id);

    const appointment = await this.client.appointment.create({
      data: {
        publicCode: input.publicCode,
        serviceId: input.service.id,
        customerId: customer.id,
        vehicleId: vehicle.id,
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

  /**
   * Matches a returning customer by their normalized phone. Runs inside the booking transaction,
   * which already holds the capacity advisory lock, so two simultaneous bookings cannot each decide
   * to create the same person.
   */
  private async resolveCustomer(input: Parameters<BookingRepository["createAppointment"]>[0]["customer"]) {
    const phoneKey = normalizePhone(input.phone);
    const existing = phoneKey
      ? await this.client.customer.findFirst({ where: { phoneNormalized: phoneKey }, orderBy: { createdAt: "asc" } })
      : null;

    if (!existing) {
      return this.client.customer.create({
        data: {
          ...(phoneKey ? { id: identityDerivedId("cus", phoneKey) } : {}),
          fullName: input.fullName,
          phone: input.phone,
          phoneNormalized: phoneKey,
          email: input.email,
        },
      });
    }

    // A booking is not a correction of the record: only what is missing gets filled in.
    const fills = {
      ...(existing.email ? {} : input.email ? { email: input.email } : {}),
    };
    return Object.keys(fills).length > 0
      ? this.client.customer.update({ where: { id: existing.id }, data: fills })
      : existing;
  }

  /**
   * Matches the unit by its normalized plate, so the same motorcycle written three different ways
   * accumulates one history. Without a plate there is nothing to match on, and joining an arbitrary
   * unit would be worse than a duplicate, so a new one is created and staff link it by hand.
   */
  private async resolveVehicle(
    input: Parameters<BookingRepository["createAppointment"]>[0]["vehicle"],
    customerId: string,
  ) {
    const plateKey = normalizeLicensePlate(input.licensePlate);
    const existing = plateKey
      ? await this.client.vehicle.findFirst({ where: { plateNormalized: plateKey }, orderBy: { createdAt: "asc" } })
      : null;

    if (!existing) {
      return this.client.vehicle.create({
        data: {
          ...(plateKey ? { id: identityDerivedId("veh", plateKey) } : {}),
          customerId,
          vehicleTypeId: await this.resolveVehicleTypeId(input.vehicleTypeId),
          brand: input.brand,
          model: input.model,
          licensePlate: input.licensePlate,
          plateNormalized: plateKey,
          year: input.year,
        },
      });
    }

    if (existing.customerId !== customerId) {
      await this.client.vehicleOwnerHistory.create({
        data: {
          vehicleId: existing.id,
          previousCustomerId: existing.customerId,
          newCustomerId: customerId,
          reason: "Public booking by a different customer.",
        },
      });
    }

    const fills = {
      ...(existing.customerId === customerId ? {} : { customerId }),
      ...(existing.year === null && input.year !== undefined ? { year: input.year } : {}),
      ...(existing.licensePlate ? {} : input.licensePlate ? { licensePlate: input.licensePlate } : {}),
    };
    return Object.keys(fills).length > 0
      ? this.client.vehicle.update({ where: { id: existing.id }, data: fills })
      : existing;
  }

  /** Falls back to the first active type, so a submission without a selector still books. */
  private async resolveVehicleTypeId(vehicleTypeId: string | undefined): Promise<string> {
    if (vehicleTypeId) {
      const chosen = await this.client.vehicleType.findFirst({ where: { id: vehicleTypeId, isActive: true } });
      if (chosen) return chosen.id;
    }

    const fallback = await this.client.vehicleType.findFirst({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!fallback) throw new Error("No active vehicle type is configured.");
    return fallback.id;
  }

  async findCancellableAppointment(appointmentId: string, token: string): Promise<PublicAppointmentRecord | null> {
    const appointment = await this.client.appointment.findFirst({
      where: { id: appointmentId, cancellationTokenHash: hashCancellationToken(token) },
      include: { service: true },
    });
    return appointment ? mapAppointment(appointment) : null;
  }

  async cancelAppointment(appointmentId: string, fromStatus: AppointmentStatus): Promise<boolean> {
    try {
      // The status filter makes the check and the write one statement, together with the history row.
      await this.client.appointment.update({
        where: { id: appointmentId, status: fromStatus },
        data: {
          status: "CANCELLED",
          statusHistory: { create: { fromStatus, toStatus: "CANCELLED", note: "Cancelled by public token." } },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return false;
      throw error;
    }
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
