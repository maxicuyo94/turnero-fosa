"use server";

import { signOut } from "@/src/lib/auth";
import { staffAccount } from "@/src/lib/composition";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { AccountError } from "@/src/modules/internal/account-service";
import type { AccountActionState } from "@/src/modules/internal/account-screen";

export async function changePasswordAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const { userId } = await requireStaff();

  try {
    await staffAccount.changeInternalPassword(userId, {
      currentPassword: formString(formData, "currentPassword"),
      newPassword: formString(formData, "newPassword"),
      confirmPassword: formString(formData, "confirmPassword"),
    });
  } catch (error) {
    if (error instanceof AccountError) return { status: "error", message: error.message, field: error.field };
    console.error("internal password change failed", error);
    return { status: "error", message: "No se pudo cambiar la contraseña. Probá nuevamente." };
  }
  // The change closed every session, this one included: the login page explains why.
  await signOut({ redirectTo: "/internal/login?notice=password-changed" });
  return { status: "success" };
}
