import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Vacia los datos operativos (turnos, clientes, unidades, pagos, emails, inventario) y conserva
// lo que hace funcionar al taller: configuracion, servicios, horarios, feriados, tipos de
// vehiculo y usuarios internos. Sin --apply solo cuenta; con --apply exige RESET_CONFIRM igual
// al host de la base, para que no se pueda correr contra otra base por error.

// Hijos antes que padres: cada tabla se borra cuando nada que se conserve la referencia.
const TABLES = [
  "EmailLog",
  "DepositPaymentAttempt",
  "AppointmentIntervalHistory",
  "AppointmentStatusHistory",
  "Appointment",
  "VehicleOwnerHistory",
  "Vehicle",
  "Customer",
  "StockCountLine",
  "StockCount",
  "InventoryMovement",
  "ShopProduct",
  "LoginThrottle",
  "Session",
  "VerificationToken",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//u.test(url)) {
    throw new Error("DATABASE_URL no es una URL de PostgreSQL. Copiá la cadena de conexión desde Neon: Vercel no descarga los valores sensibles.");
  }
  const { hostname, pathname } = new URL(url);
  const apply = process.argv.includes("--apply");
  console.log(`[reset] Base: ${hostname}${pathname}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    // Una base con migraciones atrasadas puede no tener alguna tabla todavia: se saltea.
    const existing: string[] = [];
    for (const table of TABLES) {
      const [{ found }] = await prisma.$queryRawUnsafe<{ found: boolean }[]>(`SELECT to_regclass('"${table}"') IS NOT NULL AS found`);
      if (!found) {
        console.log(`[reset] ${table.padEnd(28)} (no existe)`);
        continue;
      }
      const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${table}"`);
      console.log(`[reset] ${table.padEnd(28)} ${count}`);
      existing.push(table);
    }
    if (!apply) {
      console.log(`[reset] Solo conteo. Para borrar: RESET_CONFIRM=${hostname} pnpm tsx scripts/reset-operational-data.ts --apply`);
      return;
    }
    if (process.env.RESET_CONFIRM !== hostname) {
      throw new Error(`RESET_CONFIRM debe ser exactamente "${hostname}". No se borró nada.`);
    }
    await prisma.$transaction(async (tx) => {
      for (const table of existing) await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }, { timeout: 120_000 });
    console.log("[reset] Datos operativos borrados. Configuración, servicios, horarios y usuarios se conservaron.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
