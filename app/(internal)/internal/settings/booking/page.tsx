import { BookingSettingsCard, SettingsShell } from "@/src/modules/internal/settings-screen";
import { loadSettingsShell, type SettingsSearchParams } from "@/app/(internal)/internal/settings/shell-data";

export default async function BookingSettingsPage({ searchParams }: { searchParams?: SettingsSearchParams }) {
  const { settings, shell } = await loadSettingsShell(searchParams);
  return (
    <SettingsShell active="booking" {...shell}>
      <BookingSettingsCard settings={settings} />
    </SettingsShell>
  );
}
