"use server";

import { redirect } from "next/navigation";
import { auth, getInternalSessionUserId, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { AccountError, changeInternalPassword } from "@/src/modules/internal/account-service";
import type { AccountActionState } from "@/src/modules/internal/account-screen";

export async function changePasswordAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const session = await auth();
  const userId = getInternalSessionUserId(session);
  if (!isInternalSession(session) || !userId) redirect("/internal/login");

  try {
    await changeInternalPassword(db, userId, {
      currentPassword: stringValue(formData, "currentPassword"),
      newPassword: stringValue(formData, "newPassword"),
      confirmPassword: stringValue(formData, "confirmPassword"),
    });
    return { status: "success", message: "Contraseña actualizada. La próxima vez ingresá con la nueva." };
  } catch (error) {
    if (error instanceof AccountError) return { status: "error", message: error.message, field: error.field };
    console.error("internal password change failed", error);
    return { status: "error", message: "No se pudo cambiar la contraseña. Probá nuevamente." };
  }
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
