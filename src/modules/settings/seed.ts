import type { PrismaClient } from "@prisma/client";
import { createPasswordHash } from "@/src/lib/password";
import { workshopSeedConfig } from "@/src/modules/settings/defaults";

export const defaultWorkshopSettingsId = "default-workshop";

/**
 * Applies the editable Taller Express defaults. Safe to run repeatedly: settings and services are
 * upserted by deterministic identifiers and the recurring rows are replaced as a whole.
 */
export async function seedWorkshopConfiguration(prisma: PrismaClient): Promise<string> {
  const settings = await prisma.workshopSettings.upsert({
    where: { id: defaultWorkshopSettingsId },
    update: workshopSeedConfig.settings,
    create: { id: defaultWorkshopSettingsId, ...workshopSeedConfig.settings },
  });

  await prisma.$transaction(async (tx) => {
    await tx.weeklySchedule.deleteMany({ where: { workshopSettingsId: settings.id } });
    await tx.scheduleBreak.deleteMany({ where: { workshopSettingsId: settings.id } });
    await tx.weeklySchedule.createMany({
      data: workshopSeedConfig.schedules.map((schedule) => ({ ...schedule, workshopSettingsId: settings.id })),
    });
    await tx.scheduleBreak.createMany({
      data: workshopSeedConfig.breaks.map((scheduleBreak) => ({ ...scheduleBreak, workshopSettingsId: settings.id })),
    });
  });

  for (const service of workshopSeedConfig.services) {
    const existing = await prisma.service.findFirst({
      where: { workshopSettingsId: settings.id, displayOrder: service.displayOrder },
      select: { id: true },
    });

    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data: service });
    } else {
      await prisma.service.create({ data: { ...service, workshopSettingsId: settings.id } });
    }
  }

  return settings.id;
}

/** Credentials always come from the environment, so no secret is stored in the repository. */
export async function seedAdminUser(
  prisma: PrismaClient,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const adminUsername = env.ADMIN_USERNAME?.trim().toLowerCase();
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminUsername || !adminEmail) return null;

  const passwordHash = env.ADMIN_PASSWORD ? await createPasswordHash(env.ADMIN_PASSWORD) : undefined;
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ username: adminUsername }, { email: adminEmail }] },
    select: { id: true },
  });
  const data = {
    username: adminUsername,
    email: adminEmail,
    name: env.ADMIN_NAME ?? "Express Admin",
    ...(passwordHash ? { passwordHash } : {}),
  };

  const admin = existingAdmin
    ? await prisma.user.update({ where: { id: existingAdmin.id }, data })
    : await prisma.user.create({ data: { ...data, passwordHash } });

  return admin.id;
}
