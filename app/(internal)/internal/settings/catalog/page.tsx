import { workshopSettingsRepository } from "@/src/lib/composition";
import { ServicesCard, SettingsShell, VehicleTypesCard } from "@/src/modules/internal/settings-screen";
import { loadSettingsShell, type SettingsSearchParams } from "@/app/(internal)/internal/settings/shell-data";

export default async function CatalogSettingsPage({ searchParams }: { searchParams?: SettingsSearchParams }) {
  const { settings, shell } = await loadSettingsShell(searchParams);
  const workshop = workshopSettingsRepository();
  const [services, vehicleTypes] = await Promise.all([workshop.listServices(), workshop.listVehicleTypes()]);
  return (
    <SettingsShell active="catalog" {...shell}>
      <div className="grid gap-5 lg:grid-cols-2">
        <ServicesCard services={services} slotStepMinutes={settings.slotStepMinutes} />
        <VehicleTypesCard vehicleTypes={vehicleTypes} />
      </div>
    </SettingsShell>
  );
}
