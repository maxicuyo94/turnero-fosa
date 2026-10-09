import { requireStaff } from "@/src/lib/staff-access";
import { DesignSystemScreen } from "@/src/modules/internal/design-system-screen";

export default async function DesignSystemPage() {
  const staff = await requireStaff({ role: "ADMIN" });
  return <DesignSystemScreen signedInUserName={staff.displayName} />;
}
