import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadTestDataProfile } from "../src/modules/testing/load-test-data";
import { resolveTestDataTarget } from "../src/modules/testing/test-data-guard";

async function main() {
  const profile = process.argv[2] ?? "development";

  // The target is checked before the client exists so a forbidden database is never contacted.
  const target = resolveTestDataTarget({ profile });
  if (!target.allowed) {
    console.error(`[test-data] ${target.reason}: ${target.message}`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await loadTestDataProfile({ prisma, profile });
    if (!result.accepted) {
      console.error(`[test-data] ${result.reason}: ${result.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `[test-data] Perfil "${result.summary.profile}" cargado en ${result.host}/${result.database}: ` +
        `${result.summary.customers} clientes, ${result.summary.motorcycles} motos, ${result.summary.appointments} turnos.`,
    );
    if (!result.summary.adminConfigured) {
      console.log("[test-data] Sin usuario interno: defini ADMIN_USERNAME, ADMIN_EMAIL y ADMIN_PASSWORD en el entorno.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
