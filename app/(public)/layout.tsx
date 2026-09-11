import type { ReactNode } from "react";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}<WorkshopContact /></>;
}
