import { Prisma, type PrismaClient } from "@prisma/client";
import { workshopDayBounds } from "@/src/lib/workshop-date";
import { emailOutboxEntry } from "@/src/modules/notifications/prisma-repository";
import type { EmailNotificationDraft } from "@/src/modules/notifications/service";
import { getWorkshopSettingsRow } from "@/src/modules/settings/workshop-settings-row";
import { activeAppointmentStatuses } from "@/src/modules/appointments/schemas";
import { findCapacityConflicts } from "@/src/modules/appointments/capacity-conflicts";
import type {
  InternalAppointmentRecord,
  InternalOperationsRepository,
  InternalSchedulingRepository,
} from "@/src/modules/appointments/operations";
import { mapScheduleDateException } from "@/src/modules/settings/date-exceptions";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** The staff side of appointments: agenda reads, status changes, rescheduling and capacity checks. */
export class PrismaAppointmentRepository implements InternalOperationsRepository, InternalSchedulingRepository {
  private readonly workshopSettingsId?: string;
  /** Set only on the copy handed to a transaction's operation; never mutated afterwards. */
  private readonly tx?: TransactionClient;

  constructor(
    private readonly prisma: PrismaClient,
    options: { workshopSettingsId?: string; tx?: TransactionClient } = {},
  ) {
    this.workshopSettingsId = options.workshopSettingsId;
    this.tx = options.tx;
  }

  private get client(): PrismaClient | TransactionClient {
    return this.tx ?? this.prisma;
  }

  /** The MVP owns a single workshop; the explicit id keeps tests off the seeded row. */
  private async resolveWorkshopSettingsId(): Promise<string> {
    if (this.workshopSettingsId) return this.workshopSettingsId;
    return (await getWorkshopSettingsRow(this.prisma)).id;
  }

  async getCapacityConflicts(capacity: number, now = new Date()) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        service: { workshopSettingsId: await this.resolveWorkshopSettingsId() },
        status: { in: [...activeAppointmentStatuses] },
        endAt: { gt: now },
      },
      select: { startAt: true, endAt: true, status: true },
    });
    return findCapacityConflicts(appointments, capacity, now);
  }

  async listAppointmentsForDate(date: string): Promise<InternalAppointmentRecord[]> {
    const { start: startOfDay, end: endOfDay } = workshopDayBounds(date);
    const appointments = await this.client.appointment.findMany({
      where: { startAt: { lt: endOfDay }, endAt: { gt: startOfDay } },
      include: appointmentInclude,
      orderBy: { startAt: "asc" },
    });
    return appointments.map(mapInternalAppointment);
  }

  async listAppointmentsBetween(fromDate: string, toDate: string): Promise<InternalAppointmentRecord[]> {
    const appointments = await this.client.appointment.findMany({
      where: { startAt: { lt: workshopDayBounds(toDate).end }, endAt: { gt: workshopDayBounds(fromDate).start } },
      include: appointmentInclude,
      orderBy: { startAt: "asc" },
    });
    return appointments.map(mapInternalAppointment);
  }

  async findAppointmentById(appointmentId: string): Promise<InternalAppointmentRecord | null> {
    const appointment = await this.client.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });
    return appointment ? mapInternalAppointment(appointment) : null;
  }

  async updateAppointmentStatus(input: Parameters<InternalOperationsRepository["updateAppointmentStatus"]>[0]) {
    try {
      // The status filter makes the check and the write one statement, together with the history row.
      const appointment = await this.client.appointment.update({
        where: { id: input.appointmentId, status: input.fromStatus },
        data: {
          status: input.nextStatus,
          statusHistory: {
            create: { fromStatus: input.fromStatus, toStatus: input.nextStatus, changedById: input.changedById, note: input.note },
          },
          ...(input.notification ? { emailLogs: { create: emailOutboxEntry(input.notification) } } : {}),
        },
        include: appointmentInclude,
      });
      return mapInternalAppointment(appointment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  }

  async withSchedulingTransaction<T>(operation: (repository: InternalSchedulingRepository) => Promise<T>): Promise<T> {
    if (this.tx) return operation(this);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('public_booking_capacity'))`;
            return operation(new PrismaAppointmentRepository(this.prisma, { workshopSettingsId: this.workshopSettingsId, tx }));
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableTransactionError(error) || attempt === 3) throw error;
      }
    }
    throw new Error("Scheduling transaction retry attempts exhausted.");
  }

  async getSchedulingContext() {
    // One query instead of parallel ones: this runs inside the scheduling transaction, whose single
    // connection must not receive concurrent queries.
    const { weeklySchedules: schedules, scheduleBreaks: breaks, dateExceptions: exceptions, ...settings } =
      await this.client.workshopSettings.findUniqueOrThrow({
        where: { id: await this.resolveWorkshopSettingsId() },
        include: { weeklySchedules: true, scheduleBreaks: { orderBy: { startsAt: "asc" } }, dateExceptions: true },
      });
    return {
      settings: { capacity: settings.capacity, slotStepMinutes: settings.slotStepMinutes },
      schedules: schedules.map(({ dayOfWeek, opensAt, closesAt, isOpen }) => ({ dayOfWeek, opensAt, closesAt, isOpen })),
      breaks: breaks.map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })),
      exceptions: exceptions.map(mapScheduleDateException),
    };
  }

  async updateAppointmentInterval(input: {
    appointmentId: string;
    startAt: Date;
    endAt: Date;
    changedById: string | null;
    reason?: string;
    notification?: EmailNotificationDraft;
  }): Promise<InternalAppointmentRecord> {
    const current = await this.client.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } });
    const appointment = await this.client.appointment.update({
      where: { id: input.appointmentId },
      data: {
        startAt: input.startAt,
        endAt: input.endAt,
        intervalHistory: {
          create: {
            previousStartAt: current.startAt,
            previousEndAt: current.endAt,
            newStartAt: input.startAt,
            newEndAt: input.endAt,
            changedById: input.changedById,
            reason: input.reason,
          },
        },
        ...(input.notification ? { emailLogs: { create: emailOutboxEntry(input.notification) } } : {}),
      },
      include: appointmentInclude,
    });
    return mapInternalAppointment(appointment);
  }

}

function mapInternalAppointment(appointment: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>): InternalAppointmentRecord {
  const detailHistory = [
    ...appointment.customer.detailChanges,
    ...appointment.detailChanges,
  ].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()).slice(0, 20);
  return {
    id: appointment.id,
    publicCode: appointment.publicCode,
    serviceName: appointment.service.name,
    serviceDurationMinutes: appointment.service.durationMinutes,
    customerName: appointment.customer.fullName,
    customerPhone: appointment.customer.phone,
    customerEmail: appointment.customer.email,
    customerUpdatedAt: appointment.customer.updatedAt,
    customerDetailVersion: appointment.customer.detailVersion,
    vehicleId: appointment.vehicle.id,
    vehicleLabel: [appointment.vehicle.brand, appointment.vehicle.model, appointment.vehicle.licensePlate].filter(Boolean).join(" "),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    notes: appointment.notes,
    updatedAt: appointment.updatedAt,
    detailVersion: appointment.detailVersion,
    detailHistory: detailHistory.map((item) => ({
      id: item.id,
      field: item.field,
      previousValue: item.previousValue,
      newValue: item.newValue,
      changedAt: item.changedAt,
      changedByName: item.changedBy?.name ?? item.changedBy?.username ?? item.changedBy?.email ?? null,
      sourceAppointmentCode: item.appointment?.publicCode ?? null,
    })),
    intervalHistory: appointment.intervalHistory.map((item) => ({
      id: item.id,
      previousStartAt: item.previousStartAt,
      previousEndAt: item.previousEndAt,
      newStartAt: item.newStartAt,
      newEndAt: item.newEndAt,
      changedAt: item.changedAt,
      changedByName: item.changedBy?.name ?? item.changedBy?.username ?? item.changedBy?.email ?? null,
      reason: item.reason,
    })),
  };
}

const appointmentInclude = {
  service: true,
  customer: {
    include: {
      detailChanges: {
        where: { field: { in: ["CUSTOMER_NAME", "CUSTOMER_PHONE", "CUSTOMER_EMAIL"] } },
        include: { changedBy: true, appointment: { select: { publicCode: true } } },
        orderBy: { changedAt: "desc" as const },
        take: 20,
      },
    },
  },
  vehicle: true,
  detailChanges: {
    where: { field: "APPOINTMENT_NOTES" as const },
    include: { changedBy: true, appointment: { select: { publicCode: true } } },
    orderBy: { changedAt: "desc" as const },
    take: 20,
  },
  intervalHistory: { include: { changedBy: true }, orderBy: { changedAt: "desc" as const } },
} satisfies Prisma.AppointmentInclude;

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
