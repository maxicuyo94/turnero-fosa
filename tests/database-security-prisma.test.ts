// @vitest-environment node
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { afterAll, expect, it } from "vitest";

const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
afterAll(() => prisma.$disconnect());

it("enables RLS on every operational table", async () => {
  const rows = await prisma.$queryRaw<Array<{ name: string; enabled: boolean }>>`
    SELECT c.relname AS name, c.relrowsecurity AS enabled FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
    AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'`;
  expect(rows.length).toBeGreaterThan(20);
  expect(rows.filter((row) => !row.enabled)).toEqual([]);
});

it("denies other database roles even after an accidental table grant", async () => {
  const rollback = new Error("Rollback security probe");
  await expect(prisma.$transaction(async (tx) => {
    await tx.customer.create({ data: { id: "security-rls-fixture", fullName: "Private fixture", phone: "123456789" } });
    await tx.$executeRaw`CREATE ROLE fosa_security_probe NOLOGIN NOSUPERUSER NOBYPASSRLS`;
    await tx.$executeRaw`GRANT USAGE ON SCHEMA public TO fosa_security_probe`;
    await tx.$executeRaw`GRANT SELECT, INSERT ON "Customer" TO fosa_security_probe`;
    await tx.$executeRaw`SET LOCAL ROLE fosa_security_probe`;
    const [{ count }] = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "Customer"`;
    expect(count).toBe(BigInt(0));
    await expect(tx.$executeRaw`INSERT INTO "Customer" (id, "fullName", phone, "createdAt", "updatedAt") VALUES ('security-probe', 'Probe', '1234567', now(), now())`).rejects.toThrow(/row-level security/iu);
    throw rollback;
  })).rejects.toBe(rollback);
  const rows = await prisma.$queryRaw<Array<{ rolname: string }>>`SELECT rolname FROM pg_roles WHERE rolname = 'fosa_security_probe'`;
  expect(rows).toEqual([]); // DDL and grants rolled back; no probe account survives the test.
});

it("allows the backend role while denying administrative privileges", async () => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE fosa_backend`;
    await tx.$queryRaw`SELECT id FROM "Customer" LIMIT 1`;
    const [{ truncate }] = await tx.$queryRaw<Array<{ truncate: boolean }>>`SELECT has_table_privilege(current_user, '"Customer"', 'TRUNCATE') AS truncate`;
    expect(truncate).toBe(false);
  });
});
