import { Prisma, type PrismaClient } from "@prisma/client";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import type {
  DateExceptionImportSummary,
  ImportedHoliday,
  InternalMaintenanceRepository,
  InternalScheduleRepository,
  InternalWeeklyScheduleRecord,
  InternalWorkshopSettingsRecord,
} from "@/src/modules/internal/maintenance";
import type { InternalAppointmentRecord, InternalOperationsRepository, InternalSchedulingRepository } from "@/src/modules/internal/operations";
import { fromExceptionDate, mapScheduleDateException, toExceptionDate } from "@/src/modules/settings/date-exceptions";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export class PrismaInternalRepository
  implements InternalOperationsRepository, InternalSchedulingRepository, InternalMaintenanceRepository, InternalScheduleRepository
{
  private readonly workshopSettingsId?: string;
  private tx?: TransactionClient;

  constructor(
    private readonly prisma: PrismaClient,
    options: { workshopSettingsId?: string } = {},
  ) {
    this.workshopSettingsId = options.workshopSettingsId;
  }

  private get client(): PrismaClient | TransactionClient {
    return this.tx ?? this.prisma;
  }

  /** The MVP owns a single workshop; the explicit id keeps tests off the seeded row. */
  private async resolveWorkshopSettingsId(): Promise<string> {
    if (this.workshopSettingsId) return this.workshopSettingsId;
    const settings = await this.client.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
    return settings.id;
  }

  async getWorkshopSettings(): Promise<InternalWorkshopSettingsRecord> {
    const settings = await this.prisma.workshopSettings.findUniqueOrThrow({ where: { id: await this.resolveWorkshopSettingsId() } });
    return {
      capacity: settings.capacity,
      slotStepMinutes: settings.slotStepMinutes,
      minimumNoticeMinutes: settings.minimumNoticeMinutes,
      maximumBookingWindowDays: settings.maximumBookingWindowDays,
      depositRequired: settings.depositRequired,
      depositAmountCents: settings.depositAmountCents,
      depositExpirationMinutes: settings.depositExpirationMinutes,
    };
  }

  async listServices() {
    const services = await this.prisma.service.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      displayOrder: service.displayOrder,
    }));
  }

  async listAppointmentsForDate(date: string): Promise<InternalAppointmentRecord[]> {
    const startOfDay = new Date(`${date}T00:00:00-03:00`);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const appointments = await this.client.appointment.findMany({
      where: { startAt: { lt: endOfDay }, endAt: { gt: startOfDay } },
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

  async updateAppointmentStatus(input: { appointmentId: string; nextStatus: AppointmentStatus; changedById: string | null; note?: string }) {
    const current = await this.client.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } });
    const appointment = await this.client.appointment.update({
      where: { id: input.appointmentId },
      data: {
        status: input.nextStatus,
        statusHistory: {
          create: { fromStatus: current.status, toStatus: input.nextStatus, changedById: input.changedById, note: input.note },
        },
      },
      include: appointmentInclude,
    });
    return mapInternalAppointment(appointment);
  }

  async withSchedulingTransaction<T>(operation: () => Promise<T>): Promise<T> {
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
    throw new Error("Scheduling transaction retry attempts exhausted.");
  }

  async getSchedulingContext() {
    const workshopSettingsId = await this.resolveWorkshopSettingsId();
    const [settings, schedules, breaks, exceptions] = await Promise.all([
      this.client.workshopSettings.findUniqueOrThrow({ where: { id: workshopSettingsId } }),
      this.client.weeklySchedule.findMany({ where: { workshopSettingsId } }),
      this.client.scheduleBreak.findMany({ where: { workshopSettingsId }, orderBy: { startsAt: "asc" } }),
      this.client.scheduleDateException.findMany({ where: { workshopSettingsId } }),
    ]);
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
      },
      include: appointmentInclude,
    });
    return mapInternalAppointment(appointment);
  }

  async getWeeklySchedule(): Promise<InternalWeeklyScheduleRecord> {
    const workshopSettingsId = await this.resolveWorkshopSettingsId();
    const [schedules, breaks] = await Promise.all([
      this.prisma.weeklySchedule.findMany({ where: { workshopSettingsId } }),
      this.prisma.scheduleBreak.findMany({ where: { workshopSettingsId }, orderBy: { startsAt: "asc" } }),
    ]);

    return {
      schedules: schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        opensAt: schedule.opensAt,
        closesAt: schedule.closesAt,
        isOpen: schedule.isOpen,
      })),
      breaks: breaks.map((scheduleBreak) => ({
        dayOfWeek: scheduleBreak.dayOfWeek,
        startsAt: scheduleBreak.startsAt,
        endsAt: scheduleBreak.endsAt,
      })),
    };
  }

  /** Availability must never observe a half-written schedule, so the rows are swapped atomically. */
  async replaceWeeklySchedule(input: InternalWeeklyScheduleRecord): Promise<InternalWeeklyScheduleRecord> {
    const workshopSettingsId = await this.resolveWorkshopSettingsId();
    await this.prisma.$transaction(async (tx) => {
      await tx.weeklySchedule.deleteMany({ where: { workshopSettingsId } });
      await tx.scheduleBreak.deleteMany({ where: { workshopSettingsId } });
      await tx.weeklySchedule.createMany({ data: input.schedules.map((schedule) => ({ ...schedule, workshopSettingsId })) });
      await tx.scheduleBreak.createMany({ data: input.breaks.map((scheduleBreak) => ({ ...scheduleBreak, workshopSettingsId })) });
    });

    return this.getWeeklySchedule();
  }

  async listDateExceptions(range: { from: string; to: string }): Promise<ScheduleDateException[]> {
    const exceptions = await this.prisma.scheduleDateException.findMany({
      where: {
        workshopSettingsId: await this.resolveWorkshopSettingsId(),
        date: { gte: toExceptionDate(range.from), lte: toExceptionDate(range.to) },
      },
      orderBy: { date: "asc" },
    });
    return exceptions.map(mapScheduleDateException);
  }

  async saveDateException(input: Omit<ScheduleDateException, "source" | "manualOverride">): Promise<ScheduleDateException> {
    const workshopSettingsId = await this.resolveWorkshopSettingsId();
    const data = {
      label: input.label,
      source: "MANUAL" as const,
      manualOverride: true,
      isOpen: input.isOpen,
      opensAt: input.isOpen ? input.opensAt : null,
      closesAt: input.isOpen ? input.closesAt : null,
    };

    const exception = await this.prisma.scheduleDateException.upsert({
      where: { workshopSettingsId_date: { workshopSettingsId, date: toExceptionDate(input.date) } },
      update: data,
      create: { ...data, workshopSettingsId, date: toExceptionDate(input.date) },
    });
    return mapScheduleDateException(exception);
  }

  async deleteDateException(date: string): Promise<void> {
    await this.prisma.scheduleDateException.deleteMany({
      where: { workshopSettingsId: await this.resolveWorkshopSettingsId(), date: toExceptionDate(date) },
    });
  }

  /** Imported holidays never overwrite a workshop decision, so manual rows are counted and skipped. */
  async upsertImportedDateExceptions(holidays: ImportedHoliday[]): Promise<DateExceptionImportSummary> {
    const workshopSettingsId = await this.resolveWorkshopSettingsId();
    const dates = holidays.map((holiday) => toExceptionDate(holiday.date));

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.scheduleDateException.findMany({ where: { workshopSettingsId, date: { in: dates } } });
      const byDate = new Map(existing.map((exception) => [fromExceptionDate(exception.date), exception]));
      const summary: DateExceptionImportSummary = { imported: holidays.length, created: 0, updated: 0, preserved: 0 };

      for (const holiday of holidays) {
        const current = byDate.get(holiday.date);
        if (current?.manualOverride) {
          summary.preserved += 1;
          continue;
        }

        const data = { label: holiday.label, source: "IMPORTED" as const, isOpen: false, opensAt: null, closesAt: null };
        if (current) {
          await tx.scheduleDateException.update({ where: { id: current.id }, data });
          summary.updated += 1;
        } else {
          await tx.scheduleDateException.create({ data: { ...data, workshopSettingsId, date: toExceptionDate(holiday.date) } });
          summary.created += 1;
        }
      }

      return summary;
    });
  }

  async updateWorkshopSettings(input: InternalWorkshopSettingsRecord): Promise<InternalWorkshopSettingsRecord> {
    const updated = await this.prisma.workshopSettings.update({ where: { id: await this.resolveWorkshopSettingsId() }, data: input });
    return {
      capacity: updated.capacity,
      slotStepMinutes: updated.slotStepMinutes,
      minimumNoticeMinutes: updated.minimumNoticeMinutes,
      maximumBookingWindowDays: updated.maximumBookingWindowDays,
      depositRequired: updated.depositRequired,
      depositAmountCents: updated.depositAmountCents,
      depositExpirationMinutes: updated.depositExpirationMinutes,
    };
  }

  async updateServiceVisibility(serviceId: string, isActive: boolean) {
    const service = await this.prisma.service.update({ where: { id: serviceId }, data: { isActive } });
    return {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      displayOrder: service.displayOrder,
    };
  }
}

function mapInternalAppointment(appointment: {
  id: string;
  publicCode: string;
  service: { name: string; durationMinutes: number };
  customer: { fullName: string; phone: string; email: string | null };
  motorcycle: { brand: string; model: string; licensePlate: string | null };
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  intervalHistory: Array<{
    id: string;
    previousStartAt: Date;
    previousEndAt: Date;
    newStartAt: Date;
    newEndAt: Date;
    changedAt: Date;
    reason: string | null;
    changedBy: { name: string | null; username: string | null; email: string } | null;
  }>;
}): InternalAppointmentRecord {
  return {
    id: appointment.id,
    publicCode: appointment.publicCode,
    serviceName: appointment.service.name,
    serviceDurationMinutes: appointment.service.durationMinutes,
    customerName: appointment.customer.fullName,
    customerPhone: appointment.customer.phone,
    customerEmail: appointment.customer.email,
    motorcycleLabel: [appointment.motorcycle.brand, appointment.motorcycle.model, appointment.motorcycle.licensePlate].filter(Boolean).join(" "),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    notes: appointment.notes,
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
  customer: true,
  motorcycle: true,
  intervalHistory: { include: { changedBy: true }, orderBy: { changedAt: "desc" as const } },
} as const;

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
