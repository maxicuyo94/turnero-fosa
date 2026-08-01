import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { testDataPrefix } from "@/src/modules/testing/development-profile";
import { loadTestDataProfile } from "@/src/modules/testing/load-test-data";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const localEnv = { DATABASE_URL: getEnv().DATABASE_URL, NODE_ENV: "test" };
const now = new Date("2026-07-01T09:00:00-03:00");

describe("development test-data profile", () => {
  beforeEach(async () => {
    await deleteTestData();
  });

  afterAll(async () => {
    await deleteTestData();
    await prisma.$disconnect();
  });

  it("provides deterministic records and does not accumulate duplicates when loaded twice", async () => {
    const first = await loadTestDataProfile({ prisma, profile: "development", env: localEnv, now });
    const second = await loadTestDataProfile({ prisma, profile: "development", env: localEnv, now });

    const customers = await prisma.customer.findMany({ where: { id: { startsWith: testDataPrefix } } });
    const motorcycles = await prisma.motorcycle.findMany({ where: { id: { startsWith: testDataPrefix } } });
    const appointments = await prisma.appointment.findMany({
      where: { idempotencyKey: { startsWith: testDataPrefix } },
      orderBy: { startAt: "asc" },
    });
    const schedules = await prisma.weeklySchedule.findMany({ where: { workshopSettingsId: first.accepted ? first.summary.workshopSettingsId : "" } });

    expect(first).toMatchObject({ accepted: true, summary: { customers: 3, appointments: 3 } });
    expect(second).toMatchObject({ accepted: true });
    expect(customers).toHaveLength(3);
    expect(motorcycles).toHaveLength(3);
    expect(appointments).toHaveLength(3);
    expect(schedules).toHaveLength(7);
    expect(appointments.map((appointment) => appointment.status)).toEqual([
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "COMPLETED",
    ]);
    expect(appointments.every((appointment) => appointment.startAt >= new Date("2026-07-06T00:00:00-03:00"))).toBe(true);
  });

  it("refuses to write anything when the target is production", async () => {
    const result = await loadTestDataProfile({
      prisma,
      profile: "development",
      env: { ...localEnv, NODE_ENV: "production" },
      now,
    });

    expect(result).toMatchObject({ accepted: false, reason: "PRODUCTION_ENVIRONMENT" });
    expect(await prisma.customer.count({ where: { id: { startsWith: testDataPrefix } } })).toBe(0);
  });

  it("refuses an unknown profile without touching the database", async () => {
    const result = await loadTestDataProfile({ prisma, profile: "produccion-real", env: localEnv, now });

    expect(result).toMatchObject({ accepted: false, reason: "UNKNOWN_PROFILE" });
    expect(await prisma.customer.count({ where: { id: { startsWith: testDataPrefix } } })).toBe(0);
  });
});

async function deleteTestData() {
  await prisma.appointment.deleteMany({ where: { idempotencyKey: { startsWith: testDataPrefix } } });
  await prisma.motorcycle.deleteMany({ where: { id: { startsWith: testDataPrefix } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: testDataPrefix } } });
}
