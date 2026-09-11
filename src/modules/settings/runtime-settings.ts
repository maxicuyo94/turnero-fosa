import type { PrismaClient } from "@prisma/client";
import { getMercadoPagoEnv, getNotificationEnv } from "@/src/lib/env";

export async function getWorkshopNotificationEnv(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  if (!env.RESEND_API_KEY?.trim()) return null;
  const settings = await prisma.workshopSettings.findFirst({ orderBy: { createdAt: "asc" }, select: { emailFrom: true } });
  return getNotificationEnv({ ...env, EMAIL_FROM: settings?.emailFrom || env.EMAIL_FROM });
}

export async function getWorkshopPaymentEnv(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  const settings = await prisma.workshopSettings.findFirst({ orderBy: { createdAt: "asc" }, select: { publicAppUrl: true } });
  return getMercadoPagoEnv({ ...env, NEXT_PUBLIC_APP_URL: settings?.publicAppUrl || env.NEXT_PUBLIC_APP_URL });
}
