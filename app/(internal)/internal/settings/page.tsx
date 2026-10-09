import { ContactSettingsCard, SettingsShell } from "@/src/modules/internal/settings-screen";
import { loadSettingsShell, type SettingsSearchParams } from "@/app/(internal)/internal/settings/shell-data";

export default async function GeneralSettingsPage({ searchParams }: { searchParams?: SettingsSearchParams }) {
  const { settings, shell } = await loadSettingsShell(searchParams);
  return (
    <SettingsShell active="general" {...shell}>
      <ContactSettingsCard settings={settings} />
    </SettingsShell>
  );
}
