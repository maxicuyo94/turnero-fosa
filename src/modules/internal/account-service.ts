import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createPasswordHash, verifyPassword } from "@/src/lib/password";

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class AccountError extends Error {
  constructor(message: string, readonly field?: "currentPassword" | "newPassword" | "confirmPassword") {
    super(message);
    this.name = "AccountError";
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual."),
  newPassword: z.string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    .max(MAX_PASSWORD_LENGTH, `La contraseña nueva no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`),
  confirmPassword: z.string(),
});

/**
 * Cambia la contraseña del usuario interno con sesion iniciada. Exige la actual para que
 * una sesion abierta en un equipo ajeno no alcance para quedarse con la cuenta.
 */
export async function changeInternalPassword(
  prisma: Pick<PrismaClient, "user">,
  userId: string,
  input: unknown,
): Promise<void> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AccountError(issue?.message ?? "Revisá los datos ingresados.", issue?.path[0] as AccountError["field"]);
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) throw new AccountError("La confirmación no coincide con la contraseña nueva.", "confirmPassword");
  if (newPassword === currentPassword) throw new AccountError("La contraseña nueva tiene que ser distinta de la actual.", "newPassword");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AccountError("La contraseña actual no es correcta.", "currentPassword");
  }

  // Solo se reemplaza si nadie la cambio mientras tanto, para no pisar otro cambio simultaneo.
  const result = await prisma.user.updateMany({
    where: { id: userId, passwordHash: user.passwordHash },
    data: { passwordHash: await createPasswordHash(newPassword) },
  });
  if (result.count === 0) throw new AccountError("La contraseña se cambió desde otra sesión. Recargá la página e intentá de nuevo.");
}
