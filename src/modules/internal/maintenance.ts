import { z } from "zod";

export type InternalWorkshopSettingsRecord = {
  capacity: number;
  minimumNoticeMinutes: number;
  maximumBookingWindowDays: number;
};

export type InternalServiceRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
};

export type InternalMaintenanceRepository = {
  getWorkshopSettings?(): Promise<InternalWorkshopSettingsRecord>;
  listServices?(): Promise<InternalServiceRecord[]>;
  updateWorkshopSettings(input: InternalWorkshopSettingsRecord): Promise<InternalWorkshopSettingsRecord>;
  updateServiceVisibility(serviceId: string, isActive: boolean): Promise<InternalServiceRecord>;
};

const settingsInputSchema = z.object({
  capacity: z.coerce.number().int().min(1).max(20),
  minimumNoticeMinutes: z.coerce.number().int().min(0).max(10_080),
  maximumBookingWindowDays: z.coerce.number().int().min(1).max(365),
});

export async function updateInternalWorkshopSettings(
  repository: InternalMaintenanceRepository,
  input: z.input<typeof settingsInputSchema>,
): Promise<{ accepted: true; settings: InternalWorkshopSettingsRecord }> {
  return { accepted: true, settings: await repository.updateWorkshopSettings(settingsInputSchema.parse(input)) };
}

export async function updateInternalServiceVisibility(
  repository: InternalMaintenanceRepository,
  input: { serviceId: string; isActive: boolean },
): Promise<{ accepted: true; service: InternalServiceRecord }> {
  return { accepted: true, service: await repository.updateServiceVisibility(input.serviceId, input.isActive) };
}
