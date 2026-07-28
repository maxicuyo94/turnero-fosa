import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "../src/lib/env";
import { createPasswordHash } from "../src/lib/auth";
import { workshopSeedConfig } from "../src/modules/settings/defaults";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });

export async function main() {
  const settings = await prisma.workshopSettings.upsert({
    where: { id: "default-workshop" },
    update: {
      workshopName: workshopSeedConfig.settings.workshopName,
      capacity: workshopSeedConfig.settings.capacity,
      slotStepMinutes: workshopSeedConfig.settings.slotStepMinutes,
      minimumNoticeMinutes: workshopSeedConfig.settings.minimumNoticeMinutes,
      maximumBookingWindowDays: workshopSeedConfig.settings.maximumBookingWindowDays,
      confirmationMode: workshopSeedConfig.settings.confirmationMode,
      cancellationEnabled: workshopSeedConfig.settings.cancellationEnabled,
      reschedulingEnabled: workshopSeedConfig.settings.reschedulingEnabled,
    },
    create: {
      id: "default-workshop",
      workshopName: workshopSeedConfig.settings.workshopName,
      capacity: workshopSeedConfig.settings.capacity,
      slotStepMinutes: workshopSeedConfig.settings.slotStepMinutes,
      minimumNoticeMinutes: workshopSeedConfig.settings.minimumNoticeMinutes,
      maximumBookingWindowDays: workshopSeedConfig.settings.maximumBookingWindowDays,
      confirmationMode: workshopSeedConfig.settings.confirmationMode,
      cancellationEnabled: workshopSeedConfig.settings.cancellationEnabled,
      reschedulingEnabled: workshopSeedConfig.settings.reschedulingEnabled,
    },
  });

  await prisma.weeklySchedule.deleteMany({ where: { workshopSettingsId: settings.id } });
  await prisma.scheduleBreak.deleteMany({ where: { workshopSettingsId: settings.id } });

  await prisma.weeklySchedule.createMany({
    data: workshopSeedConfig.schedules.map((schedule) => ({ ...schedule, workshopSettingsId: settings.id })),
  });
  await prisma.scheduleBreak.createMany({
    data: workshopSeedConfig.breaks.map((scheduleBreak) => ({ ...scheduleBreak, workshopSettingsId: settings.id })),
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

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const passwordHash = process.env.ADMIN_PASSWORD ? await createPasswordHash(process.env.ADMIN_PASSWORD) : undefined;
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { name: process.env.ADMIN_NAME ?? "Express Admin", ...(passwordHash ? { passwordHash } : {}) },
      create: { email: adminEmail, name: process.env.ADMIN_NAME ?? "Express Admin", passwordHash },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
