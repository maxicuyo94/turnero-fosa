import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type AppointmentStatus } from "@prisma/client";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { PrismaCodeRecoveryRepository } from "@/src/modules/booking/support-repository";
import { recoverPublicCodes } from "@/src/modules/booking/code-recovery";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const target = resolveTestDataTarget({ profile: "development", env: { ...process.env, NODE_ENV: "test" } });
const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
const recipient = `recovery-${randomUUID()}@test.invalid`;
const otherRecipient = `other-${recipient}`;
const now = new Date();
let customerId: string;
let vehicleId: string;
let serviceId: string;
const appointmentIds: string[] = [];

describe.skipIf(!target.allowed)("recovery email ownership and outbox", () => {
  beforeAll(async () => {
    serviceId = (await prisma.service.findFirstOrThrow({ where: { isActive: true } })).id;
    const vehicleType = await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } });
    const customer = await prisma.customer.create({ data: { fullName: "Recovery fixture", phone: randomUUID(), email: recipient } });
    customerId = customer.id;
    vehicleId = (await prisma.vehicle.create({ data: { customerId, vehicleTypeId: vehicleType.id, brand: "Fixture", model: "Recovery" } })).id;
  });
  beforeEach(async () => { await prisma.emailLog.deleteMany({ where: { recipient: { in: [recipient, otherRecipient] } } }); await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } }); appointmentIds.length = 0; });
  afterAll(async () => {
    await prisma.emailLog.deleteMany({ where: { recipient: { in: [recipient, otherRecipient] } } });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  async function appointment(contactEmail: string | null, status: AppointmentStatus = "CONFIRMED", days = 2) {
    const startAt = new Date(now.getTime() + days * 86_400_000);
    const row = await prisma.appointment.create({ data: { customerId, vehicleId, serviceId, contactEmail, status, startAt, endAt: new Date(startAt.getTime() + 1800000), idempotencyKey: randomUUID() } });
    appointmentIds.push(row.id);
    return row;
  }

  it("recovers only codes belonging to the email on the booking, not to the shared customer", async () => {
    const own = await appointment(recipient.toUpperCase());
    const other = await appointment(otherRecipient);
    const missing = await appointment(null);
    await expect(recoverPublicCodes(new PrismaCodeRecoveryRepository(prisma), { email: recipient, now })).resolves.toBe(true);
    const emails = await prisma.emailLog.findMany({ where: { recipient } });
    expect(emails).toHaveLength(1);
    expect(emails[0].status).toBe("PENDING");
    expect(emails[0].event).toBe("PUBLIC_CODE_RECOVERY");
    expect(emails[0].body).toContain(own.publicCode);
    expect(emails[0].body).not.toContain(other.publicCode);
    expect(emails[0].body).not.toContain(missing.publicCode);
  });
  it("does not queue mail for unknown, cancelled or past appointments", async () => {
    await appointment(recipient, "CANCELLED");
    await appointment(recipient, "CONFIRMED", -1);
    await expect(recoverPublicCodes(new PrismaCodeRecoveryRepository(prisma), { email: recipient, now })).resolves.toBe(false);
    expect(await prisma.emailLog.count({ where: { recipient } })).toBe(0);
  });
});
