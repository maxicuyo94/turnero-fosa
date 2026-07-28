import { describe, expect, it } from "vitest";
import {
  updateInternalServiceVisibility,
  updateInternalWorkshopSettings,
  type InternalMaintenanceRepository,
  type InternalServiceRecord,
  type InternalWorkshopSettingsRecord,
} from "@/src/modules/internal/maintenance";

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
