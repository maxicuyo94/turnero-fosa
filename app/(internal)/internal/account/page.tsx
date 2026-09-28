import { redirect } from "next/navigation";
import { staffAccount } from "@/src/lib/composition";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { MIN_PASSWORD_LENGTH } from "@/src/modules/internal/account-service";
import { InternalAccountScreen } from "@/src/modules/internal/account-screen";

export default async function InternalAccountPage() {
  const staff = await requireStaff();

  const user = await staffAccount.findStaffProfile(staff.userId);
  if (!user) redirect("/internal/login");

  return <InternalAccountScreen canManageWorkshop={hasRole(staff, "ADMIN")} minPasswordLength={MIN_PASSWORD_LENGTH} user={user} />;
}
