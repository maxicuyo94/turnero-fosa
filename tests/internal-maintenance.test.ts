import { describe, expect, it } from "vitest";
import {
  deleteInternalDateException,
  saveInternalDateException,
  updateInternalServiceVisibility,
  updateInternalWeeklySchedule,
  updateInternalWorkshopSettings,
  type InternalMaintenanceRepository,
  type InternalServiceRecord,
  type InternalWorkshopSettingsRecord,
} from "@/src/modules/internal/maintenance";
import { InMemoryScheduleRepository } from "@/tests/helpers/in-memory-schedule-repository";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";

describe("internal settings and catalog maintenance", () => {
  it("updates workshop capacity so future availability can use editable settings", async () => {
    const repository = new InMemoryMaintenanceRepository();

    const result = await updateInternalWorkshopSettings(repository, { capacity: 3, minimumNoticeMinutes: 180, maximumBookingWindowDays: 20 });

    expect(result).toEqual({ accepted: true, settings: expect.objectContaining({ capacity: 3, minimumNoticeMinutes: 180, maximumBookingWindowDays: 20 }) });
  });

  it("toggles service visibility without deleting existing internal records", async () => {
    const repository = new InMemoryMaintenanceRepository();

    const result = await updateInternalServiceVisibility(repository, { serviceId: "oil", isActive: false });

    expect(result).toEqual({ accepted: true, service: expect.objectContaining({ id: "oil", isActive: false }) });
    expect(repository.services).toHaveLength(1);
  });
});

describe("internal weekly schedule maintenance", () => {
  it("persists the complete weekly schedule and its breaks as one unit", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await updateInternalWeeklySchedule(repository, {
      schedules: workshopSeedConfig.schedules.map((schedule) => ({ ...schedule, opensAt: "08:00", closesAt: "16:00" })),
      breaks: [{ dayOfWeek: "MONDAY", startsAt: "12:00", endsAt: "13:00" }],
    });

    expect(result).toMatchObject({ accepted: true });
    expect(repository.replacements).toBe(1);
    expect(repository.schedule.schedules).toHaveLength(7);
    expect(repository.schedule.breaks).toEqual([{ dayOfWeek: "MONDAY", startsAt: "12:00", endsAt: "13:00" }]);
  });

  it("rejects a schedule that does not cover every weekday exactly once", async () => {
    const repository = new InMemoryScheduleRepository();

    const missing = await updateInternalWeeklySchedule(repository, { schedules: workshopSeedConfig.schedules.slice(0, 6), breaks: [] });
    const duplicated = await updateInternalWeeklySchedule(repository, {
      schedules: [...workshopSeedConfig.schedules.slice(0, 6), workshopSeedConfig.schedules[0]],
      breaks: [],
    });

    expect(missing).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(duplicated).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(repository.replacements).toBe(0);
  });

  it("rejects a closing time that is not after the opening time of an open day", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await updateInternalWeeklySchedule(repository, {
      schedules: workshopSeedConfig.schedules.map((schedule) =>
        schedule.dayOfWeek === "MONDAY" ? { ...schedule, opensAt: "19:00", closesAt: "09:00" } : schedule,
      ),
      breaks: [],
    });

    expect(result).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(repository.replacements).toBe(0);
  });

  it("rejects breaks that fall outside the opening hours, overlap, or land on a closed day", async () => {
    const repository = new InMemoryScheduleRepository();
    const schedules = workshopSeedConfig.schedules;

    const outside = await updateInternalWeeklySchedule(repository, {
      schedules,
      breaks: [{ dayOfWeek: "MONDAY", startsAt: "08:00", endsAt: "10:00" }],
    });
    const overlapping = await updateInternalWeeklySchedule(repository, {
      schedules,
      breaks: [
        { dayOfWeek: "MONDAY", startsAt: "13:00", endsAt: "15:00" },
        { dayOfWeek: "MONDAY", startsAt: "14:00", endsAt: "16:00" },
      ],
    });
    const closedDay = await updateInternalWeeklySchedule(repository, {
      schedules,
      breaks: [{ dayOfWeek: "SUNDAY", startsAt: "10:00", endsAt: "11:00" }],
    });
    const inverted = await updateInternalWeeklySchedule(repository, {
      schedules,
      breaks: [{ dayOfWeek: "MONDAY", startsAt: "15:00", endsAt: "13:00" }],
    });

    expect(outside).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(overlapping).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(closedDay).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(inverted).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(repository.replacements).toBe(0);
  });
});

describe("internal date exception maintenance", () => {
  it("stores a closed date without touching the recurring weekly schedule", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await saveInternalDateException(repository, {
      date: "2026-07-09",
      label: "Dia de la Independencia",
      isOpen: false,
    });

    expect(result).toMatchObject({ accepted: true, exception: expect.objectContaining({ date: "2026-07-09", isOpen: false }) });
    expect(repository.replacements).toBe(0);
    expect(repository.schedule.schedules).toEqual(workshopSeedConfig.schedules);
  });

  it("stores an exceptionally open date with its hours as a manual override", async () => {
    const repository = new InMemoryScheduleRepository();

    const result = await saveInternalDateException(repository, {
      date: "2026-07-09",
      label: "Abrimos igual",
      isOpen: true,
      opensAt: "10:00",
      closesAt: "13:00",
    });

    expect(result).toMatchObject({
      accepted: true,
      exception: expect.objectContaining({ isOpen: true, opensAt: "10:00", closesAt: "13:00", manualOverride: true, source: "MANUAL" }),
    });
  });

  it("rejects an open date without valid hours and an invalid date", async () => {
    const repository = new InMemoryScheduleRepository();

    const withoutHours = await saveInternalDateException(repository, { date: "2026-07-09", label: "Sin horas", isOpen: true });
    const inverted = await saveInternalDateException(repository, {
      date: "2026-07-09",
      label: "Invertido",
      isOpen: true,
      opensAt: "13:00",
      closesAt: "10:00",
    });
    const invalidDate = await saveInternalDateException(repository, { date: "09/07/2026", label: "Formato", isOpen: false });

    expect(withoutHours).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(inverted).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(invalidDate).toMatchObject({ accepted: false, reason: "VALIDATION_FAILED" });
    expect(repository.exceptions).toHaveLength(0);
  });

  it("removes an exception so the weekday schedule applies again", async () => {
    const repository = new InMemoryScheduleRepository();
    await saveInternalDateException(repository, { date: "2026-07-09", label: "Feriado", isOpen: false });

    const result = await deleteInternalDateException(repository, { date: "2026-07-09" });

    expect(result).toEqual({ accepted: true });
    expect(repository.exceptions).toHaveLength(0);
  });
});

class InMemoryMaintenanceRepository implements InternalMaintenanceRepository {
  settings: InternalWorkshopSettingsRecord = { capacity: 2, minimumNoticeMinutes: 120, maximumBookingWindowDays: 30 };
  services: InternalServiceRecord[] = [{ id: "oil", name: "Service Esencial", durationMinutes: 60, isActive: true, displayOrder: 1 }];

  async updateWorkshopSettings(input: InternalWorkshopSettingsRecord) {
    this.settings = input;
    return this.settings;
  }

  async updateServiceVisibility(serviceId: string, isActive: boolean) {
    const found = this.services.find((item) => item.id === serviceId);
    if (!found) throw new Error("Service not found");
    found.isActive = isActive;
    return found;
  }
}
