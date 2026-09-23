"use server";

import { db } from "@/src/lib/db";
import { formString } from "@/src/lib/form-data";
import { requireStaff } from "@/src/lib/staff-access";
import { AccountError, changeInternalPassword } from "@/src/modules/internal/account-service";
import type { AccountActionState } from "@/src/modules/internal/account-screen";

export async function changePasswordAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const { userId } = await requireStaff();

  try {
    await changeInternalPassword(db, userId, {
      currentPassword: formString(formData, "currentPassword"),
      newPassword: formString(formData, "newPassword"),
      confirmPassword: formString(formData, "confirmPassword"),
    });
    return { status: "success", message: "Contraseña actualizada. La próxima vez ingresá con la nueva." };
  } catch (error) {
    if (error instanceof AccountError) return { status: "error", message: error.message, field: error.field };
    console.error("internal password change failed", error);
    return { status: "error", message: "No se pudo cambiar la contraseña. Probá nuevamente." };
  }
}
