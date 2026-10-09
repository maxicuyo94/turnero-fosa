import type { ReactNode } from "react";
import { connection } from "next/server";
import { workshopContactSettings } from "@/src/lib/composition";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  // Contact and refund policy must use the current saved settings, including on token-only pages.
  await connection();
  return <>{children}<WorkshopContact settings={await workshopContactSettings()} /></>;
}
