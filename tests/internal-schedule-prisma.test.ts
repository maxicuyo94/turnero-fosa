import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";
import { PrismaInternalRepository } from "@/src/modules/internal/prisma-repository";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";
import type { WeeklySchedule } from "@/src/modules/settings/schemas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const workshopSettingsId = "it-schedule-workshop";
const repository = new PrismaInternalRepository(prisma, { workshopSettingsId });

describe("Prisma internal schedule integration", () => {
  beforeEach(async () => {
    await deleteScheduleTestData();
    await prisma.workshopSettings.create({
      data: {
        id: workshopSettingsId,
        ...workshopSeedConfig.settings,
        weeklySchedules: { createMany: { data: workshopSeedConfig.schedules } },
        scheduleBreaks: { createMany: { data: workshopSeedConfig.breaks } },
      },
    });
  });

  afterAll(async () => {
    await deleteScheduleTestData();
    await prisma.$disconnect();
  });

  it("replaces the complete weekly schedule and its breaks in one transaction", async () => {
    const schedules = workshopSeedConfig.schedules.map((schedule) => ({ ...schedule, opensAt: "08:00", closesAt: "16:00" }));

    const result = await repository.replaceWeeklySchedule({
      schedules,
      breaks: [{ dayOfWeek: "MONDAY", startsAt: "12:00", endsAt: "13:00" }],
    });

    const stored = await prisma.weeklySchedule.findMany({ where: { workshopSettingsId } });
    const storedBreaks = await prisma.scheduleBreak.findMany({ where: { workshopSettingsId } });
    expect(result.schedules).toHaveLength(7);
    expect(stored).toHaveLength(7);
    expect(stored.every((schedule) => schedule.opensAt === "08:00" && schedule.closesAt === "16:00")).toBe(true);
    expect(storedBreaks).toEqual([expect.objectContaining({ dayOfWeek: "MONDAY", startsAt: "12:00", endsAt: "13:00" })]);
  });

  it("keeps the previous configuration when the replacement fails midway", async () => {
    const invalidSchedules = [
      ...workshopSeedConfig.schedules.slice(0, 6),
      { ...workshopSeedConfig.schedules[6], dayOfWeek: "FUNDAY" as unknown as WeeklySchedule["dayOfWeek"] },
    ];

    await expect(repository.replaceWeeklySchedule({ schedules: invalidSchedules, breaks: [] })).rejects.toThrow();

    const stored = await prisma.weeklySchedule.findMany({ where: { workshopSettingsId }, orderBy: { dayOfWeek: "asc" } });
    const storedBreaks = await prisma.scheduleBreak.findMany({ where: { workshopSettingsId } });
    expect(stored).toHaveLength(7);
    expect(stored.every((schedule) => schedule.opensAt === "09:00")).toBe(true);
    expect(storedBreaks).toHaveLength(workshopSeedConfig.breaks.length);
  });

  it("round-trips date exceptions as calendar dates without timezone drift", async () => {
    await repository.saveDateException({
      date: "2026-07-09",
      label: "Dia de la Independencia",
      isOpen: false,
      opensAt: null,
      closesAt: null,
    });

    const exceptions = await repository.listDateExceptions({ from: "2026-07-01", to: "2026-07-31" });
    expect(exceptions).toEqual([
      expect.objectContaining({ date: "2026-07-09", label: "Dia de la Independencia", source: "MANUAL", manualOverride: true, isOpen: false }),
    ]);
  });

  it("preserves manual overrides and refreshes imported rows when importing holidays", async () => {
    await repository.saveDateException({ date: "2026-07-09", label: "Abrimos igual", isOpen: true, opensAt: "10:00", closesAt: "13:00" });
    await repository.upsertImportedDateExceptions([{ date: "2026-05-01", label: "Fecha vieja" }]);

    const result = await repository.upsertImportedDateExceptions([
      { date: "2026-07-09", label: "Dia de la Independencia" },
      { date: "2026-05-01", label: "Dia del Trabajador" },
      { date: "2026-12-25", label: "Navidad" },
    ]);

    const exceptions = await repository.listDateExceptions({ from: "2026-01-01", to: "2026-12-31" });
    expect(result).toEqual({ imported: 3, created: 1, updated: 1, preserved: 1 });
    expect(exceptions).toEqual([
      expect.objectContaining({ date: "2026-05-01", label: "Dia del Trabajador", source: "IMPORTED", isOpen: false }),
      expect.objectContaining({ date: "2026-07-09", label: "Abrimos igual", manualOverride: true, isOpen: true, opensAt: "10:00" }),
      expect.objectContaining({ date: "2026-12-25", label: "Navidad", source: "IMPORTED", isOpen: false }),
    ]);
  });
});

async function deleteScheduleTestData() {
  await prisma.workshopSettings.deleteMany({ where: { id: workshopSettingsId } });
}
