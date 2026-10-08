import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new SerializedPrismaPg({ connectionString: getDatabaseUrl() });

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
