import { redirect } from "next/navigation";
import { db } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/staff-access";
import { MIN_PASSWORD_LENGTH } from "@/src/modules/internal/account-service";
import { InternalAccountScreen } from "@/src/modules/internal/account-screen";

export default async function InternalAccountPage() {
  const staff = await requireStaff();

  const user = await db.user.findUnique({ where: { id: staff.userId }, select: { name: true, username: true, email: true } });
  if (!user) redirect("/internal/login");

  return <InternalAccountScreen minPasswordLength={MIN_PASSWORD_LENGTH} user={user} />;
}
