import type { PrismaClient } from "@prisma/client";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import type { InternalMaintenanceRepository, InternalWorkshopSettingsRecord } from "@/src/modules/internal/maintenance";
import type { InternalAppointmentRecord, InternalOperationsRepository } from "@/src/modules/internal/operations";

export class PrismaInternalRepository implements InternalOperationsRepository, InternalMaintenanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getWorkshopSettings(): Promise<InternalWorkshopSettingsRecord> {
    const settings = await this.prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    return {
      capacity: settings.capacity,
      minimumNoticeMinutes: settings.minimumNoticeMinutes,
      maximumBookingWindowDays: settings.maximumBookingWindowDays,
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
    const appointments = await this.prisma.appointment.findMany({
      where: { startAt: { lt: endOfDay }, endAt: { gt: startOfDay } },
      include: { service: true, customer: true, motorcycle: true },
      orderBy: { startAt: "asc" },
    });
    return appointments.map(mapInternalAppointment);
  }

  async findAppointmentById(appointmentId: string): Promise<InternalAppointmentRecord | null> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, customer: true, motorcycle: true },
    });
    return appointment ? mapInternalAppointment(appointment) : null;
  }

  async updateAppointmentStatus(input: { appointmentId: string; nextStatus: AppointmentStatus; changedById: string | null; note?: string }) {
    const current = await this.prisma.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } });
    const appointment = await this.prisma.appointment.update({
      where: { id: input.appointmentId },
      data: {
        status: input.nextStatus,
        statusHistory: {
          create: { fromStatus: current.status, toStatus: input.nextStatus, changedById: input.changedById, note: input.note },
        },
      },
      include: { service: true, customer: true, motorcycle: true },
    });
    return mapInternalAppointment(appointment);
  }

  async updateWorkshopSettings(input: InternalWorkshopSettingsRecord): Promise<InternalWorkshopSettingsRecord> {
    const settings = await this.prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    const updated = await this.prisma.workshopSettings.update({ where: { id: settings.id }, data: input });
    return {
      capacity: updated.capacity,
      minimumNoticeMinutes: updated.minimumNoticeMinutes,
      maximumBookingWindowDays: updated.maximumBookingWindowDays,
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
  service: { name: string };
  customer: { fullName: string; phone: string; email: string | null };
  motorcycle: { brand: string; model: string; licensePlate: string | null };
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  notes: string | null;
}): InternalAppointmentRecord {
  return {
    id: appointment.id,
    serviceName: appointment.service.name,
    customerName: appointment.customer.fullName,
    customerPhone: appointment.customer.phone,
    customerEmail: appointment.customer.email,
    motorcycleLabel: [appointment.motorcycle.brand, appointment.motorcycle.model, appointment.motorcycle.licensePlate].filter(Boolean).join(" "),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    notes: appointment.notes,
  };
}
