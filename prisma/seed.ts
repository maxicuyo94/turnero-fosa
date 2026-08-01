import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "../src/lib/env";
import { seedAdminUser, seedWorkshopConfiguration } from "../src/modules/settings/seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });

export async function main() {
  await seedWorkshopConfiguration(prisma);
  await seedAdminUser(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
