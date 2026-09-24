import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  PlateChangeInput,
  PlateChangeOutcome,
  VehicleHistoryRepository,
  VehicleRecord,
  VehicleSummary,
} from "@/src/modules/vehicles/service";

export class PrismaVehicleRepository implements VehicleHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listVehicles(): Promise<VehicleSummary[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      include: {
        vehicleType: true,
        customer: true,
        appointments: { orderBy: { startAt: "desc" }, select: { startAt: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      typeName: vehicle.vehicleType.name,
      brand: vehicle.brand,
      model: vehicle.model,
      licensePlate: vehicle.licensePlate,
      plateNormalized: vehicle.plateNormalized,
      year: vehicle.year,
      ownerName: vehicle.customer.fullName,
      ownerPhone: vehicle.customer.phone,
      appointmentCount: vehicle.appointments.length,
      lastVisitAt: vehicle.appointments[0]?.startAt ?? null,
    }));
  }

  async updateVehicle(vehicleId: string, data: Record<string, unknown>) {
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data });
  }

  async findVehicleRecord(vehicleId: string): Promise<VehicleRecord | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        vehicleType: true,
        customer: true,
        appointments: { include: { service: true }, orderBy: { startAt: "desc" } },
        ownerHistory: { orderBy: { changedAt: "desc" } },
        plateChanges: { include: { changedBy: true }, orderBy: { changedAt: "desc" } },
      },
    });
    if (!vehicle) return null;

    // Owner changes store ids; the names come from one extra lookup instead of a relation per row.
    const customerIds = [
      ...new Set(vehicle.ownerHistory.flatMap((entry) => [entry.previousCustomerId, entry.newCustomerId])),
    ].filter((id): id is string => id !== null);
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(customers.map((customer) => [customer.id, customer.fullName]));

    return {
      id: vehicle.id,
      typeName: vehicle.vehicleType.name,
      vehicleTypeId: vehicle.vehicleTypeId,
      brand: vehicle.brand,
      model: vehicle.model,
      licensePlate: vehicle.licensePlate,
      plateNormalized: vehicle.plateNormalized,
      year: vehicle.year,
      vin: vehicle.vin,
      engineNumber: vehicle.engineNumber,
      color: vehicle.color,
      notes: vehicle.notes,
      ownerName: vehicle.customer.fullName,
      ownerPhone: vehicle.customer.phone,
      appointmentCount: vehicle.appointments.length,
      lastVisitAt: vehicle.appointments[0]?.startAt ?? null,
      appointments: vehicle.appointments.map((appointment) => ({
        id: appointment.id,
        publicCode: appointment.publicCode,
        serviceName: appointment.service.name,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        status: appointment.status,
        notes: appointment.notes,
      })),
      ownerChanges: vehicle.ownerHistory.map((entry) => ({
        id: entry.id,
        previousOwnerName: entry.previousCustomerId ? nameById.get(entry.previousCustomerId) ?? null : null,
        newOwnerName: nameById.get(entry.newCustomerId) ?? "Cliente",
        reason: entry.reason,
        changedAt: entry.changedAt,
      })),
      plateChanges: vehicle.plateChanges.map((change) => ({
        id: change.id,
        previousPlate: change.previousPlate,
        newPlate: change.newPlate,
        changedByName: change.changedBy?.name ?? change.changedBy?.username ?? null,
        changedAt: change.changedAt,
      })),
    };
  }

  /** One transaction: the conflict check, the new plate and its history row, or nothing. */
  async changePlate(input: PlateChangeInput): Promise<PlateChangeOutcome> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId }, select: { licensePlate: true, plateNormalized: true } });
        if (!vehicle) return { status: "MISSING" as const };
        if (vehicle.plateNormalized === input.plateNormalized && vehicle.licensePlate === input.licensePlate) return { status: "UNCHANGED" as const };
        if (input.plateNormalized) {
          const holder = await tx.vehicle.findFirst({ where: { plateNormalized: input.plateNormalized, id: { not: input.vehicleId } }, select: { id: true } });
          if (holder) return { status: "TAKEN" as const, otherVehicleId: holder.id };
        }
        await tx.vehicle.update({ where: { id: input.vehicleId }, data: { licensePlate: input.licensePlate, plateNormalized: input.plateNormalized } });
        await tx.vehiclePlateChange.create({
          data: { vehicleId: input.vehicleId, previousPlate: vehicle.licensePlate, newPlate: input.licensePlate, changedById: input.changedById },
        });
        return { status: "CHANGED" as const };
      });
    } catch (error) {
      // A booking took the plate between the check and the write: the unique index has the last word.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.plateNormalized) {
        const holder = await this.prisma.vehicle.findFirst({ where: { plateNormalized: input.plateNormalized }, select: { id: true } });
        if (holder) return { status: "TAKEN", otherVehicleId: holder.id };
      }
      throw error;
    }
  }
}
