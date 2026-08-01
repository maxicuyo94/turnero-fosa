import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { PrismaBookingRepository } from "@/src/modules/booking/prisma-repository";
import { createPublicBooking, getPublicAppointmentStatus } from "@/src/modules/booking/service";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const now = new Date("2026-07-01T09:00:00-03:00");
const date = "2026-07-20";
let serviceId = "";

describe("Prisma public booking integration", () => {
  beforeEach(async () => {
    await deleteTestAppointments();
    await applyExpressBookingPolicy();
    serviceId = await activeServiceId();
  });

  afterAll(async () => {
    await deleteTestAppointments();
    await prisma.$disconnect();
  });

  it("creates an automatically confirmed booking and keeps repeated idempotency safe", async () => {
    // Pinned explicitly: the Express default is manual confirmation until the
    // deposit payment capability exists, but the automatic path still ships.
    await applyExpressBookingPolicy({ confirmationMode: "AUTOMATIC" });
    const repository = new PrismaBookingRepository(prisma);
    const input = bookingInput({ idempotencyKey: "it-public-repeat-token", startTime: "09:00" });

    const first = await createPublicBooking(repository, input);
    const repeated = await createPublicBooking(repository, input);

    expect(first).toMatchObject({ accepted: true, appointment: { status: "CONFIRMED" } });
    expect(first.accepted ? first.appointment.publicCode : "").toMatch(/^[A-HJ-NP-Z2-9]{10}$/u);
    expect(first.accepted ? first.cancellationToken : "unexpected").toBeNull();
    expect(repeated).toMatchObject({
      accepted: true,
      message: "Este pedido de turno ya fue recibido. Usa el mensaje original para acceder al enlace de cancelacion.",
      appointment: { idempotencyKey: "it-public-repeat-token" },
    });
    expect(repeated.accepted ? repeated.cancellationToken : "unexpected").toBeNull();
    expect(repeated.accepted && first.accepted ? repeated.appointment.publicCode : "unexpected").toBe(
      first.accepted ? first.appointment.publicCode : "unexpected",
    );

    const lookup = first.accepted
      ? await getPublicAppointmentStatus(repository, { code: first.appointment.publicCode.toLowerCase() })
      : null;
    expect(lookup).toMatchObject({ accepted: true, appointment: { status: "CONFIRMED" } });
  });

  it("accepts at most one concurrent request for the final remaining capacity in PostgreSQL", async () => {
    const seededRepository = new PrismaBookingRepository(prisma);
    const seed = await createPublicBooking(seededRepository, bookingInput({ idempotencyKey: "it-public-capacity-seed", startTime: "10:00" }));
    expect(seed.accepted).toBe(true);

    const attempts = await Promise.all([
      createPublicBooking(new PrismaBookingRepository(prisma), bookingInput({ idempotencyKey: "it-public-capacity-a", startTime: "10:00" })),
      createPublicBooking(new PrismaBookingRepository(prisma), bookingInput({ idempotencyKey: "it-public-capacity-b", startTime: "10:00" })),
    ]);

    expect(attempts.filter((result) => result.accepted)).toHaveLength(1);
    expect(attempts.filter((result) => !result.accepted).map((result) => result.accepted ? "" : result.reason)).toEqual(["SLOT_UNAVAILABLE"]);
  });
});

function bookingInput(overrides: { idempotencyKey: string; startTime: string }) {
  return {
    serviceId,
    date,
    startTime: overrides.startTime,
    customer: { fullName: `Integration Rider ${randomUUID()}`, phone: `+54911${Math.floor(Math.random() * 1_000_000_000)}`, email: `${overrides.idempotencyKey}@example.com` },
    motorcycle: { brand: "Honda", model: "XR150", licensePlate: overrides.idempotencyKey.toUpperCase() },
    idempotencyKey: overrides.idempotencyKey,
    now,
  } satisfies Parameters<typeof createPublicBooking>[1];
}

async function activeServiceId(): Promise<string> {
  const service = await prisma.service.findFirst({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
  if (!service) throw new Error("Seed an active service before running integration tests.");
  return service.id;
}

async function applyExpressBookingPolicy(
  overrides: { confirmationMode?: "MANUAL" | "AUTOMATIC" } = {},
) {
  await prisma.workshopSettings.updateMany({
    data: {
      confirmationMode: overrides.confirmationMode ?? workshopSeedConfig.settings.confirmationMode,
      cancellationEnabled: workshopSeedConfig.settings.cancellationEnabled,
      reschedulingEnabled: workshopSeedConfig.settings.reschedulingEnabled,
    },
  });
}

async function deleteTestAppointments() {
  const appointments = await prisma.appointment.findMany({
    where: { idempotencyKey: { startsWith: "it-public-" } },
    select: { id: true, motorcycleId: true },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.id) } } });
  await prisma.motorcycle.deleteMany({ where: { id: { in: appointments.map((appointment) => appointment.motorcycleId) } } });
}
