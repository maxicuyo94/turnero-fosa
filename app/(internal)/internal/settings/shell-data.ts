import { appointmentRepository, workshopSettingsRepository } from "@/src/lib/composition";
import { requireStaff } from "@/src/lib/staff-access";
import { parseSettingsFeedback } from "@/src/modules/internal/settings-navigation";

export type SettingsSearchParams = Promise<{ date?: string; feedback?: string }> | undefined;

/** What every Configuración page needs: an administrator, the stored settings and the capacity warning. */
export async function loadSettingsShell(searchParams: SettingsSearchParams) {
  const staff = await requireStaff({ role: "ADMIN" });
  const params = await searchParams;
  const settings = await workshopSettingsRepository().getWorkshopSettings();
  const capacityConflicts = await appointmentRepository().getCapacityConflicts(settings.capacity);
  return {
    params,
    settings,
    shell: {
      capacity: settings.capacity,
      capacityConflicts,
      feedback: parseSettingsFeedback(params?.feedback),
      signedInUserName: staff.displayName,
    },
  };
}
