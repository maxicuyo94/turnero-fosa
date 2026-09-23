import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { PrismaEmailDeliveryRepository } from "@/src/modules/notifications/prisma-repository";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const repository = new PrismaEmailDeliveryRepository(prisma);
const recipient = "it-outbox@taller.test";
const now = new Date();
// Claims go oldest first, so fixtures dated long ago are claimed before any other pending row.
const longAgo = new Date("1990-01-01T00:00:00Z");

describe("Prisma email outbox", () => {
  beforeEach(async () => {
    await prisma.emailLog.deleteMany({ where: { recipient } });
  });

  afterAll(async () => {
    await prisma.emailLog.deleteMany({ where: { recipient } });
    await prisma.$disconnect();
  });

  it("never hands the same due email to two concurrent dispatchers", async () => {
    await prisma.emailLog.createMany({
      data: Array.from({ length: 6 }, (_, index) => ({
        event: "PUBLIC_BOOKING_CREATED",
        recipient,
        subject: `Mail ${index}`,
        body: "Body",
        createdAt: longAgo,
        nextAttemptAt: longAgo,
      })),
    });
    const leaseUntil = new Date(now.getTime() + 60_000);

    const [first, second] = await Promise.all([
      repository.claimDueEmails({ now, limit: 4, leaseUntil }),
      repository.claimDueEmails({ now, limit: 4, leaseUntil }),
    ]);
    const mine = [...first, ...second].filter((email) => email.recipient === recipient);

    expect(new Set(mine.map((email) => email.id)).size).toBe(mine.length);
    expect(mine).toHaveLength(6);
    expect(mine.every((email) => email.attempts === 1)).toBe(true);
    // Leased rows are not due again until the lease runs out.
    const again = await repository.claimDueEmails({ now, limit: 10, leaseUntil });
    expect(again.filter((email) => email.recipient === recipient)).toEqual([]);
  });

  it("records the outcome of each delivery", async () => {
    const sent = await prisma.emailLog.create({ data: { event: "PUBLIC_BOOKING_CREATED", recipient, subject: "S", body: "B" } });
    const failed = await prisma.emailLog.create({ data: { event: "PUBLIC_BOOKING_CREATED", recipient, subject: "S", body: "B" } });

    await repository.markSent(sent.id, "provider-1", now);
    await repository.markFailed(failed.id, "Provider down.");

    expect(await prisma.emailLog.findUniqueOrThrow({ where: { id: sent.id } })).toMatchObject({ status: "SENT", providerId: "provider-1", sentAt: now });
    expect(await prisma.emailLog.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ status: "FAILED", errorMessage: "Provider down." });
  });
});
