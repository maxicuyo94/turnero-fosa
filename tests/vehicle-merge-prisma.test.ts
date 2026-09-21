import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { PrismaVehicleRepository } from "@/src/modules/vehicles/prisma-repository";
import { getVehicleRecord, mergeVehicles } from "@/src/modules/vehicles/service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const prefix = "it-merge-";

describe("duplicate vehicle merge", () => {
  beforeEach(async () => {
    await deleteTestData();
  });

  afterAll(async () => {
    await deleteTestData();
    await prisma.$disconnect();
  });

  it("moves every appointment of the source onto the target and removes the source", async () => {
    const { source, target } = await seedDuplicatePair();
    const repository = new PrismaVehicleRepository(prisma);

    const result = await mergeVehicles(repository, {
      sourceVehicleId: source,
      targetVehicleId: target,
      requestKey: `${prefix}key-1`,
      mergedById: null,
    });

    expect(result).toMatchObject({ accepted: true, movedAppointments: 1 });
    expect(await prisma.vehicle.findUnique({ where: { id: source } })).toBeNull();
    expect(await prisma.appointment.count({ where: { vehicleId: target } })).toBe(2);
  });

  it("does not apply a second merge for a request key already used", async () => {
    const { source, target } = await seedDuplicatePair();
    const repository = new PrismaVehicleRepository(prisma);
    const input = { sourceVehicleId: source, targetVehicleId: target, requestKey: `${prefix}key-2`, mergedById: null };

    const first = await mergeVehicles(repository, input);
    const repeated = await mergeVehicles(repository, input);

    expect(first.accepted).toBe(true);
    expect(repeated).toMatchObject({ accepted: true, repeated: true });
    expect(await prisma.vehicleMerge.count({ where: { requestKey: `${prefix}key-2` } })).toBe(1);
    expect(await prisma.appointment.count({ where: { vehicleId: target } })).toBe(2);
  });

  it("fills only the empty fields of the target", async () => {
    const { source, target } = await seedDuplicatePair();
    await prisma.vehicle.update({ where: { id: source }, data: { vin: "VIN-DEL-ORIGEN", color: "Rojo", year: 2019 } });
    await prisma.vehicle.update({ where: { id: target }, data: { vin: null, color: "Negro", year: 2022 } });

    await mergeVehicles(new PrismaVehicleRepository(prisma), {
      sourceVehicleId: source,
      targetVehicleId: target,
      requestKey: `${prefix}key-3`,
      mergedById: null,
    });

    const merged = await prisma.vehicle.findUniqueOrThrow({ where: { id: target } });
    expect(merged.vin).toBe("VIN-DEL-ORIGEN");
    expect(merged.color).toBe("Negro");
    expect(merged.year).toBe(2022);
  });

  it("refuses to merge a unit into itself", async () => {
    const { target } = await seedDuplicatePair();

    const result = await mergeVehicles(new PrismaVehicleRepository(prisma), {
      sourceVehicleId: target,
      targetVehicleId: target,
      requestKey: `${prefix}key-4`,
      mergedById: null,
    });

    expect(result.accepted).toBe(false);
    expect(await prisma.vehicle.findUnique({ where: { id: target } })).not.toBeNull();
  });

  it("refuses a merge whose source or target no longer exists", async () => {
    const { source } = await seedDuplicatePair();

    const result = await mergeVehicles(new PrismaVehicleRepository(prisma), {
      sourceVehicleId: source,
      targetVehicleId: `${prefix}missing`,
      requestKey: `${prefix}key-5`,
      mergedById: null,
    });

    expect(result.accepted).toBe(false);
    expect(await prisma.vehicle.findUnique({ where: { id: source } })).not.toBeNull();
  });

  it("shows the merged history as one timeline on the surviving unit", async () => {
    const { source, target } = await seedDuplicatePair();
    await mergeVehicles(new PrismaVehicleRepository(prisma), {
      sourceVehicleId: source,
      targetVehicleId: target,
      requestKey: `${prefix}key-6`,
      mergedById: null,
    });

    const record = await getVehicleRecord(new PrismaVehicleRepository(prisma), { vehicleId: target });

    expect(record).not.toBeNull();
    expect(record?.appointments).toHaveLength(2);
    expect(record?.merges).toHaveLength(1);
    // Newest first, so the last visit is what the workshop reads at the top.
    const dates = record?.appointments.map((appointment) => appointment.startAt.getTime()) ?? [];
    expect([...dates]).toEqual([...dates].sort((a, b) => b - a));
  });
});

async function seedDuplicatePair() {
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } });
  const service = await prisma.service.findFirstOrThrow({ where: { isActive: true } });
  const plate = `MG${Math.floor(Math.random() * 90_000 + 10_000)}ZZ`;
  const customer = await prisma.customer.create({
    data: { id: `${prefix}${randomUUID()}`, fullName: "Merge Rider", phone: `11${Math.floor(Math.random() * 1_000_000)}` },
  });

  const source = await prisma.vehicle.create({
    data: {
      id: `${prefix}${randomUUID()}`,
      customerId: customer.id,
      vehicleTypeId: vehicleType.id,
      brand: "Honda",
      model: "XR150",
      licensePlate: plate.toLowerCase(),
      plateNormalized: plate,
    },
  });
  const target = await prisma.vehicle.create({
    data: {
      id: `${prefix}${randomUUID()}`,
      customerId: customer.id,
      vehicleTypeId: vehicleType.id,
      brand: "Honda",
      model: "XR150",
      licensePlate: plate,
      plateNormalized: plate,
    },
  });

  for (const [index, vehicleId] of [source.id, target.id].entries()) {
    await prisma.appointment.create({
      data: {
        serviceId: service.id,
        customerId: customer.id,
        vehicleId,
        startAt: new Date(`2026-07-2${index + 1}T09:00:00-03:00`),
        endAt: new Date(`2026-07-2${index + 1}T10:00:00-03:00`),
        idempotencyKey: `${prefix}${randomUUID()}`,
        status: "COMPLETED",
      },
    });
  }

  return { source: source.id, target: target.id };
}

async function deleteTestData() {
  await prisma.appointment.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
  await prisma.vehicleMerge.deleteMany({ where: { requestKey: { startsWith: prefix } } });
  await prisma.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: prefix } } });
}
