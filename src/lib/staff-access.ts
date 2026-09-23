import { cache } from "react";
import { redirect } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { auth, getInternalSessionUserId } from "@/src/lib/auth";
import { db } from "@/src/lib/db";

export type { StaffRole } from "@prisma/client";

export type StaffMember = {
  userId: string;
  displayName: string;
  role: StaffRole;
};

/**
 * The signed-in staff member, read from the database rather than trusted from the token, so a
 * deleted account or a changed role takes effect on the next request. Cached per request.
 */
export const getStaffMember = cache(async (): Promise<StaffMember | null> => {
  const userId = getInternalSessionUserId(await auth());
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, email: true, role: true },
  });
  if (!user) return null;

  return { userId: user.id, displayName: user.name || user.username || user.email, role: user.role };
});

/** The only access check for internal pages and actions: signs out strangers, refuses the wrong role. */
export async function requireStaff(options: { role?: StaffRole } = {}): Promise<StaffMember> {
  const staff = await getStaffMember();
  if (!staff) redirect("/internal/login");
  if (options.role && !hasRole(staff, options.role)) redirect("/internal?feedback=forbidden");
  return staff;
}

export function hasRole(staff: Pick<StaffMember, "role">, role: StaffRole): boolean {
  return role === "STAFF" || staff.role === "ADMIN";
}
