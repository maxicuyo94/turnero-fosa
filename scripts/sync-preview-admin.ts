import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { seedAdminUser } from "@/src/modules/settings/seed";

async function main() {
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_TARGET_ENV === "preview";

  if (!isPreview) {
    console.log("Skipping Preview admin synchronization outside Vercel Preview.");
    return;
  }

  const requiredVariables = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;
  const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());

  if (missingVariables.length > 0) {
    throw new Error(`Preview admin synchronization requires: ${missingVariables.join(", ")}.`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    await seedAdminUser(prisma);
    console.log("Preview admin credentials synchronized.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
