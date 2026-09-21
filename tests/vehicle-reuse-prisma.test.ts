import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { createPublicBooking } from "@/src/modules/booking/service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const now = new Date("2026-07-01T09:00:00-03:00");
const date = "2026-07-20";
let serviceId = "";

describe("vehicle reuse across bookings", () => {
  beforeEach(async () => {
    await deleteTestData();
    await applyAutomaticPolicy();
    serviceId = await activeServiceId();
  });

  afterAll(async () => {
    await deleteTestData();
    await prisma.$disconnect();
  });

  it("attaches a second booking to the vehicle already on record", async () => {
    const repository = new PrismaBookingRepository(prisma);
    const plate = uniquePlate();

    const first = await createPublicBooking(repository, bookingInput({ key: "it-reuse-same-1", startTime: "09:00", plate }));
    const second = await createPublicBooking(repository, bookingInput({ key: "it-reuse-same-2", startTime: "11:00", plate }));

    expect(first.accepted && second.accepted).toBe(true);
    const vehicles = await vehiclesForPlate(plate);
    expect(vehicles).toHaveLength(1);
    expect(await appointmentVehicleIds(["it-reuse-same-1", "it-reuse-same-2"])).toEqual([vehicles[0].id, vehicles[0].id]);
  });

  it("treats spacing and punctuation variants as the same unit", async () => {
    const repository = new PrismaBookingRepository(prisma);
    const plate = uniquePlate();
    const spaced = `${plate.slice(0, 2)} ${plate.slice(2, 5)} ${plate.slice(5)}`;
    const dashed = `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`;

    await createPublicBooking(repository, bookingInput({ key: "it-reuse-spacing-1", startTime: "09:00", plate }));
    await createPublicBooking(repository, bookingInput({ key: "it-reuse-spacing-2", startTime: "11:00", plate: spaced }));
    await createPublicBooking(repository, bookingInput({ key: "it-reuse-spacing-3", startTime: "15:00", plate: dashed.toLowerCase() }));

    expect(await vehiclesForPlate(plate)).toHaveLength(1);
  });

  it("creates a separate unit for every booking without a plate", async () => {
    const repository = new PrismaBookingRepository(prisma);

    await createPublicBooking(repository, bookingInput({ key: "it-reuse-noplate-1", startTime: "09:00", plate: undefined }));
    await createPublicBooking(repository, bookingInput({ key: "it-reuse-noplate-2", startTime: "11:00", plate: undefined }));

    const [firstId, secondId] = await appointmentVehicleIds(["it-reuse-noplate-1", "it-reuse-noplate-2"]);
    expect(firstId).not.toBe(secondId);
  });

  it("keeps exactly one unit when two bookings for the same plate race", async () => {
    const plate = uniquePlate();

    const [first, second] = await Promise.all([
      createPublicBooking(new PrismaBookingRepository(prisma), bookingInput({ key: "it-reuse-race-1", startTime: "09:00", plate })),
      createPublicBooking(new PrismaBookingRepository(prisma), bookingInput({ key: "it-reuse-race-2", startTime: "11:00", plate })),
    ]);

    expect(first.accepted && second.accepted).toBe(true);
    const vehicles = await vehiclesForPlate(plate);
    expect(vehicles).toHaveLength(1);
    expect(await appointmentVehicleIds(["it-reuse-race-1", "it-reuse-race-2"])).toEqual([vehicles[0].id, vehicles[0].id]);
  });

  it("preserves stored data and only fills what was empty", async () => {
    const repository = new PrismaBookingRepository(prisma);
    const plate = uniquePlate();
    await createPublicBooking(repository, bookingInput({ key: "it-reuse-keep-1", startTime: "09:00", plate }));

    const stored = (await vehiclesForPlate(plate))[0];
    await prisma.vehicle.update({ where: { id: stored.id }, data: { year: null } });

    await createPublicBooking(repository, {
      ...bookingInput({ key: "it-reuse-keep-2", startTime: "11:00", plate }),
      vehicle: { brand: "Marca Reescrita", model: "Modelo Reescrito", licensePlate: plate, year: 2020 },
    });

    const after = (await vehiclesForPlate(plate))[0];
    expect(after.brand).toBe("Honda");
    expect(after.model).toBe("XR150");
    expect(after.year).toBe(2020);
  });

  it("moves the unit to the customer who books and records the change", async () => {
    const repository = new PrismaBookingRepository(prisma);
    const plate = uniquePlate();
    await createPublicBooking(repository, bookingInput({ key: "it-reuse-owner-1", startTime: "09:00", plate }));
    const before = (await vehiclesForPlate(plate))[0];

    await createPublicBooking(repository, {
      ...bookingInput({ key: "it-reuse-owner-2", startTime: "11:00", plate }),
      customer: { fullName: "Duena Nueva", phone: `+54911${Math.floor(Math.random() * 1_000_000_000)}`, email: "nueva@example.com" },
    });

    const after = (await vehiclesForPlate(plate))[0];
    expect(after.id).toBe(before.id);
    expect(after.customerId).not.toBe(before.customerId);

    const history = await prisma.vehicleOwnerHistory.findMany({ where: { vehicleId: after.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ previousCustomerId: before.customerId, newCustomerId: after.customerId });
  });

  it("assigns the seeded vehicle type when the booking does not choose one", async () => {
    const repository = new PrismaBookingRepository(prisma);
    const plate = uniquePlate();

    await createPublicBooking(repository, bookingInput({ key: "it-reuse-type-1", startTime: "09:00", plate }));

    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { plateNormalized: plate },
      include: { vehicleType: true },
    });
    expect(vehicle.vehicleType.name).toBe("Moto");
  });
});

function uniquePlate() {
  return `IT${Math.floor(Math.random() * 90_000 + 10_000)}ZZ`;
}

function bookingInput(overrides: { key: string; startTime: string; plate: string | undefined }) {
  return {
    serviceId,
    date,
    startTime: overrides.startTime,
    customer: {
      fullName: `Reuse Rider ${randomUUID()}`,
      phone: `+54911${Math.floor(Math.random() * 1_000_000_000)}`,
      email: `${overrides.key}@example.com`,
    },
    vehicle: { brand: "Honda", model: "XR150", licensePlate: overrides.plate, year: 2022 },
    idempotencyKey: overrides.key,
    now,
  } satisfies Parameters<typeof createPublicBooking>[1];
}

async function vehiclesForPlate(plate: string) {
  return prisma.vehicle.findMany({ where: { plateNormalized: plate.toUpperCase() }, orderBy: { createdAt: "asc" } });
}

async function appointmentVehicleIds(keys: string[]) {
  const appointments = await prisma.appointment.findMany({
    where: { idempotencyKey: { in: keys } },
    orderBy: { idempotencyKey: "asc" },
    select: { vehicleId: true },
  });
  return appointments.map((appointment) => appointment.vehicleId);
}

async function activeServiceId() {
  const service = await prisma.service.findFirstOrThrow({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
  return service.id;
}

async function applyAutomaticPolicy() {
  const settings = await prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  await prisma.workshopSettings.update({
    where: { id: settings.id },
    data: { confirmationMode: "AUTOMATIC", depositRequired: false, cancellationEnabled: false },
  });
}

async function deleteTestData() {
  const appointments = await prisma.appointment.findMany({
    where: { idempotencyKey: { startsWith: "it-reuse-" } },
    select: { id: true, vehicleId: true, customerId: true },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: appointments.map((item) => item.id) } } });
  const vehicleIds = [...new Set(appointments.map((item) => item.vehicleId))];
  await prisma.vehicleOwnerHistory.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: [...new Set(appointments.map((item) => item.customerId))] } } });
}
