import type { PrismaClient } from "@prisma/client";
import { getMercadoPagoEnv, getNotificationEnv, previewBranchOrigin } from "@/src/lib/env";
import { findWorkshopSettingsRow } from "@/src/modules/settings/workshop-settings-row";

export async function getWorkshopNotificationEnv(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  if (!env.RESEND_API_KEY?.trim()) return null;
  const settings = await findWorkshopSettingsRow(prisma);
  return getNotificationEnv({ ...env, EMAIL_FROM: settings?.emailFrom || env.EMAIL_FROM });
}

export async function getWorkshopPaymentEnv(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  const settings = await findWorkshopSettingsRow(prisma);
  return getMercadoPagoEnv({ ...env, NEXT_PUBLIC_APP_URL: settings?.publicAppUrl || env.NEXT_PUBLIC_APP_URL });
}

/**
 * Origin customers are sent back to: the branch URL on a preview, otherwise the domain saved in the
 * settings, otherwise NEXT_PUBLIC_APP_URL. Null when none of them is a valid URL.
 */
export async function getWorkshopPublicOrigin(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  const settings = await findWorkshopSettingsRow(prisma);
  const candidate = previewBranchOrigin(env) ?? settings?.publicAppUrl ?? env.NEXT_PUBLIC_APP_URL?.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}
