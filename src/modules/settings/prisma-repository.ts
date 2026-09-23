import type { PrismaClient } from "@prisma/client";
import { fromExceptionDate, mapScheduleDateException, toExceptionDate } from "@/src/modules/settings/date-exceptions";
import type {
  DateExceptionImportSummary,
  ImportedHoliday,
  InternalMaintenanceRepository,
  InternalScheduleRepository,
  InternalWeeklyScheduleRecord,
  InternalWorkshopSettingsRecord,
} from "@/src/modules/settings/maintenance";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";
import { getWorkshopSettingsRow } from "@/src/modules/settings/workshop-settings-row";

/** How the workshop operates: settings, services, vehicle types, weekly hours and special dates. */
export class PrismaWorkshopSettingsRepository implements InternalMaintenanceRepository, InternalScheduleRepository {
  constructor(
    private readonly prisma: PrismaClient,
    /** The MVP owns a single workshop; an explicit id keeps tests off the seeded row. */
    private readonly options: { workshopSettingsId?: string } = {},
  ) {}

  private async resolveWorkshopSettingsId(): Promise<string> {
    return this.options.workshopSettingsId ?? (await getWorkshopSettingsRow(this.prisma)).id;
  }

  async getWorkshopSettings(): Promise<InternalWorkshopSettingsRecord> {
    return mapWorkshopSettings(
      await this.prisma.workshopSettings.findUniqueOrThrow({ where: { id: await this.resolveWorkshopSettingsId() } }),
    );
  }

  async updateWorkshopSettings(input: InternalWorkshopSettingsRecord): Promise<InternalWorkshopSettingsRecord> {
    return mapWorkshopSettings(
      await this.prisma.workshopSettings.update({ where: { id: await this.resolveWorkshopSettingsId() }, data: input }),
    );
  }

  async listServices() {
    const services = await this.prisma.service.findMany({
      where: { workshopSettingsId: await this.resolveWorkshopSettingsId() },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return services.map(mapService);
  }

  async updateServiceVisibility(serviceId: string, isActive: boolean) {
    return mapService(await this.prisma.service.update({ where: { id: serviceId }, data: { isActive } }));
  }

  async updateServiceDuration(serviceId: string, durationMinutes: number) {
    return this.prisma.service.update({
      where: { id: serviceId, workshopSettingsId: await this.resolveWorkshopSettingsId() },
      data: { durationMinutes },
    });
  }

  async listVehicleTypes() {
    const vehicleTypes = await this.prisma.vehicleType.findMany({
      where: { workshopSettingsId: await this.resolveWorkshopSettingsId() },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return vehicleTypes.map(mapVehicleType);
  }

  async createVehicleType(input: { name: string; displayOrder: number }) {
    return mapVehicleType(
      await this.prisma.vehicleType.create({
        data: { ...input, workshopSettingsId: await this.resolveWorkshopSettingsId() },
      }),
    );
  }

  async updateVehicleTypeVisibility(vehicleTypeId: string, isActive: boolean) {
    return mapVehicleType(await this.prisma.vehicleType.update({ where: { id: vehicleTypeId }, data: { isActive } }));
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
}

function mapWorkshopSettings(settings: InternalWorkshopSettingsRecord): InternalWorkshopSettingsRecord {
  return {
    publicPhone: settings.publicPhone,
    whatsappNumber: settings.whatsappNumber,
    publicAppUrl: settings.publicAppUrl,
    emailFrom: settings.emailFrom,
    depositRefundPolicy: settings.depositRefundPolicy,
    depositActivationDate: settings.depositActivationDate,
    capacity: settings.capacity,
    slotStepMinutes: settings.slotStepMinutes,
    minimumNoticeMinutes: settings.minimumNoticeMinutes,
    maximumBookingWindowDays: settings.maximumBookingWindowDays,
    depositRequired: settings.depositRequired,
    depositAmountCents: settings.depositAmountCents,
    depositExpirationMinutes: settings.depositExpirationMinutes,
  };
}

function mapService(service: { id: string; name: string; durationMinutes: number; isActive: boolean; displayOrder: number }) {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    displayOrder: service.displayOrder,
  };
}

function mapVehicleType(vehicleType: { id: string; name: string; isActive: boolean; displayOrder: number }) {
  return {
    id: vehicleType.id,
    name: vehicleType.name,
    isActive: vehicleType.isActive,
    displayOrder: vehicleType.displayOrder,
  };
}
