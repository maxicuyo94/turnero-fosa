import "dotenv/config";
import { PrismaClient, type ShopOrder } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { encryptSensitive, isEncrypted } from "@/src/lib/data-encryption";
import { encryptOrderContact, orderPrivateFields } from "@/src/modules/shop/order-privacy";

// Requires a real key even when run outside production. Restartable, with no sensitive output.
if (!/^[a-f0-9]{64}$/iu.test(process.env.DATA_ENCRYPTION_KEY ?? "")) throw new Error("Configure DATA_ENCRYPTION_KEY before migrating the outbox.");
const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
async function main() {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const rows = await prisma.emailLog.findMany({ orderBy: { id: "asc" }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, recipient: true, subject: true, body: true, errorMessage: true } });
    if (!rows.length) break;
    for (const row of rows) {
      const data: { recipient?: string; subject?: string; body?: string; errorMessage?: string } = {};
      if (!isEncrypted(row.recipient)) data.recipient = encryptSensitive(row.recipient, "email-recipient");
      if (row.subject !== null && !isEncrypted(row.subject)) data.subject = encryptSensitive(row.subject, "email-subject");
      if (row.body !== null && !isEncrypted(row.body)) data.body = encryptSensitive(row.body, "email-body");
      if (row.errorMessage !== null && !isEncrypted(row.errorMessage)) data.errorMessage = encryptSensitive(row.errorMessage.slice(0, 2000), "email-error");
      if (Object.keys(data).length) {
        // Do not overwrite a concurrently modified row.
        const result = await prisma.emailLog.updateMany({ where: { id: row.id, recipient: row.recipient, subject: row.subject, body: row.body, errorMessage: row.errorMessage }, data });
        count += result.count;
      }
    }
    cursor = rows.at(-1)!.id;
  }
  console.log(`Encrypted ${count} outbox records.`);
  cursor = undefined;
  let orders = 0;
  for (;;) {
    const rows: ShopOrder[] = await prisma.shopOrder.findMany({ orderBy: { id: "asc" }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!rows.length) break;
    for (const row of rows) {
      if (orderPrivateFields.every((field) => row[field] === null || isEncrypted(row[field]!))) continue;
      const contact = Object.fromEntries(orderPrivateFields.map((field) => [field, row[field]])) as Pick<typeof row, typeof orderPrivateFields[number]>;
      // Already encrypted fields remain untouched so interrupted runs are safe to resume.
      const encrypted = encryptOrderContact(contact);
      const data = Object.fromEntries(orderPrivateFields.filter((field) => row[field] !== null && !isEncrypted(row[field]!)).map((field) => [field, encrypted[field]]));
      orders += (await prisma.shopOrder.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data })).count;
    }
    cursor = rows.at(-1)!.id;
  }
  console.log(`Encrypted ${orders} order records. Run again if operations were active during migration.`);
}
main().catch(() => { console.error("Data encryption failed; no sensitive data was printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
