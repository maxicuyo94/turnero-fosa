import type { ReactNode } from "react";
import { workshopContactSettings } from "@/src/lib/composition";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}<WorkshopContact settings={await workshopContactSettings()} /></>;
}
