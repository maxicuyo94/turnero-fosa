import { cache } from "react";
import type { PrismaClient } from "@prisma/client";

/**
 * The app serves a single workshop, and its settings are the oldest row. Every reader outside a
 * transaction goes through here, so the rule lives in one place and a page render reads the row once
 * per request instead of once per component. Reads that must be consistent with a transaction keep
 * querying through the transaction client.
 */
export const findWorkshopSettingsRow = cache((prisma: PrismaClient) =>
  prisma.workshopSettings.findFirst({ orderBy: { createdAt: "asc" } }),
);

export async function getWorkshopSettingsRow(prisma: PrismaClient) {
  const settings = await findWorkshopSettingsRow(prisma);
  if (!settings) throw new Error("Workshop settings are not seeded.");
  return settings;
}
