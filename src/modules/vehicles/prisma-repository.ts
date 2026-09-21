import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  VehicleHistoryRepository,
  VehicleMergeOutcome,
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
        mergesReceived: { include: { mergedBy: true }, orderBy: { mergedAt: "desc" } },
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
      merges: vehicle.mergesReceived.map((merge) => ({
        id: merge.id,
        sourceLabel: merge.sourceLabel,
        movedAppointments: merge.movedAppointments,
        mergedByName: merge.mergedBy?.name ?? merge.mergedBy?.username ?? null,
        mergedAt: merge.mergedAt,
      })),
    };
  }

  /**
   * One transaction: the appointments move, the empty fields of the target are filled, the audit row
   * is written and the source is deleted, or nothing happens. The unique request key is what makes a
   * resubmitted form a no-op rather than a second merge.
   */
  async applyMerge(input: {
    sourceVehicleId: string;
    targetVehicleId: string;
    requestKey: string;
    mergedById: string | null;
  }): Promise<VehicleMergeOutcome> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const alreadyApplied = await tx.vehicleMerge.findUnique({ where: { requestKey: input.requestKey } });
        if (alreadyApplied) {
          return { status: "REPEATED" as const, movedAppointments: alreadyApplied.movedAppointments };
        }

        const [source, target] = await Promise.all([
          tx.vehicle.findUnique({ where: { id: input.sourceVehicleId } }),
          tx.vehicle.findUnique({ where: { id: input.targetVehicleId } }),
        ]);
        if (!source || !target) return { status: "MISSING" as const };

        const moved = await tx.appointment.updateMany({
          where: { vehicleId: source.id },
          data: { vehicleId: target.id },
        });

        // Only what the surviving record is missing; a merge never overwrites its data.
        const fills = {
          ...(target.licensePlate ? {} : source.licensePlate ? { licensePlate: source.licensePlate } : {}),
          ...(target.plateNormalized ? {} : source.plateNormalized ? { plateNormalized: source.plateNormalized } : {}),
          ...(target.year === null && source.year !== null ? { year: source.year } : {}),
          ...(target.vin ? {} : source.vin ? { vin: source.vin } : {}),
          ...(target.engineNumber ? {} : source.engineNumber ? { engineNumber: source.engineNumber } : {}),
          ...(target.color ? {} : source.color ? { color: source.color } : {}),
          ...(target.notes ? {} : source.notes ? { notes: source.notes } : {}),
        };
        if (Object.keys(fills).length > 0) {
          await tx.vehicle.update({ where: { id: target.id }, data: fills });
        }

        await tx.vehicleMerge.create({
          data: {
            requestKey: input.requestKey,
            sourceVehicleId: source.id,
            sourceLabel: [source.brand, source.model, source.licensePlate].filter(Boolean).join(" "),
            targetVehicleId: target.id,
            movedAppointments: moved.count,
            mergedById: input.mergedById,
          },
        });

        // The owner history of the source goes with it; the surviving record keeps its own.
        await tx.vehicleOwnerHistory.deleteMany({ where: { vehicleId: source.id } });
        await tx.vehicle.delete({ where: { id: source.id } });

        return { status: "APPLIED" as const, movedAppointments: moved.count };
      });
    } catch (error) {
      // Two identical submissions racing: the loser hits the unique key and is a no-op, not an error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const applied = await this.prisma.vehicleMerge.findUnique({ where: { requestKey: input.requestKey } });
        return { status: "REPEATED" as const, movedAppointments: applied?.movedAppointments ?? 0 };
      }
      throw error;
    }
  }
}
