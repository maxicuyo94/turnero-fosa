import { redirect } from "next/navigation";
import { auth, getInternalSessionUserId, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/src/modules/internal/account-service";
import { InternalAccountScreen } from "@/src/modules/internal/account-screen";

export default async function InternalAccountPage() {
  const session = await auth();
  const userId = getInternalSessionUserId(session);
  if (!isInternalSession(session) || !userId) redirect("/internal/login");

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, username: true, email: true } });
  if (!user) redirect("/internal/login");

  return <InternalAccountScreen minPasswordLength={MIN_PASSWORD_LENGTH} user={user} />;
}
