import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const target = resolveTestDataTarget({ profile: "development", env: { ...process.env, NODE_ENV: "test" } });
const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
let settingsId: string;
let originalCancellation: boolean;
let customerId: string;
let vehicleId: string;
let serviceId: string;
const appointmentIds: string[] = [];
const recoveryEmails: string[] = [];

test.beforeAll(async () => {
  if (!target.allowed) return;
  const settings = await prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  settingsId = settings.id; originalCancellation = settings.cancellationEnabled;
  serviceId = (await prisma.service.findFirstOrThrow({ where: { isActive: true } })).id;
  const vehicleType = await prisma.vehicleType.findFirstOrThrow({ where: { isActive: true } });
  customerId = (await prisma.customer.create({ data: { fullName: "Booking support fixture", phone: randomUUID() } })).id;
  vehicleId = (await prisma.vehicle.create({ data: { customerId, vehicleTypeId: vehicleType.id, brand: "Fixture", model: "Support" } })).id;
});
test.beforeEach(async () => { if (!target.allowed) test.skip(true, target.message); });
test.afterEach(async () => {
  if (!target.allowed) return;
  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } }); appointmentIds.length = 0;
  await prisma.workshopSettings.update({ where: { id: settingsId }, data: { cancellationEnabled: originalCancellation } });
});
test.afterAll(async () => {
  if (target.allowed) {
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.loginThrottle.deleteMany({ where: { key: { in: recoveryEmails.map((email) => `recovery-email:${createHash("sha256").update(email).digest("hex")}`) } } });
  }
  await prisma.$disconnect();
});

async function fixture(status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
  const token = randomUUID().replaceAll("-", "");
  const startAt = new Date(Date.now() + 3 * 86_400_000);
  const appointment = await prisma.appointment.create({ data: { serviceId, customerId, vehicleId, startAt, endAt: new Date(startAt.getTime() + 1800000), status, idempotencyKey: randomUUID(), cancellationTokenHash: createHash("sha256").update(token).digest("hex") } });
  appointmentIds.push(appointment.id);
  return { ...appointment, token, url: `/booking/cancel?appointmentId=${appointment.id}&token=${token}` };
}

test("suggested next date opens real available slots", async ({ page }) => {
  await page.goto(`/booking?serviceId=${serviceId}&date=2000-01-01`);
  const next = page.getByRole("link", { name: /Ver próxima fecha/ });
  await expect(next).toBeVisible();
  const href = await next.getAttribute("href");
  expect(href).toContain(`serviceId=${serviceId}`);
  await next.click();
  await expect(page.getByRole("radio").first()).toBeVisible();
});

test("recovery explains ownership and responds without exposing codes", async ({ page }) => {
  const email = `missing-${randomUUID()}@test.invalid`; recoveryEmails.push(email);
  await page.goto("/booking/status");
  await page.getByText("¿Perdiste el código?", { exact: true }).click();
  await page.getByLabel("Email de la reserva").fill(email);
  await page.getByRole("button", { name: "Enviar códigos por email" }).click();
  await expect(page.getByText(/Si ese email tiene turnos próximos|El envío de emails no está disponible/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Estado del turno" })).toHaveCount(0);
  expect(await prisma.emailLog.count({ where: { recipient: email } })).toBe(0);
});

test("cancellation previews payment and cancels only after confirmation", async ({ page }) => {
  await prisma.workshopSettings.update({ where: { id: settingsId }, data: { cancellationEnabled: true } });
  const appointment = await fixture();
  await prisma.depositPaymentAttempt.create({ data: { appointmentId: appointment.id, externalReference: randomUUID(), status: "APPROVED", amountCents: 500000, expiresAt: new Date(Date.now() + 60000) } });
  const response = await page.goto(appointment.url);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByText(appointment.publicCode, { exact: true })).toBeVisible();
  await expect(page.getByText(/Seña pagada/)).toBeVisible();
  expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe("CONFIRMED");
  await page.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(page.getByText(/Tu turno fue cancelado/)).toBeVisible();
  expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe("CANCELLED");
  expect((await prisma.depositPaymentAttempt.findFirstOrThrow({ where: { appointmentId: appointment.id } })).status).toBe("APPROVED");
  await page.goto(appointment.url);
  await expect(page.getByRole("button", { name: "Confirmar cancelación" })).toHaveCount(0);
});

test("invalid secrets and disabled cancellation expose no actionable form", async ({ page }) => {
  const appointment = await fixture();
  await page.goto(`/booking/cancel?appointmentId=${appointment.id}&token=${"b".repeat(32)}`);
  await expect(page.getByText(appointment.publicCode, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar cancelación" })).toHaveCount(0);
  await prisma.workshopSettings.update({ where: { id: settingsId }, data: { cancellationEnabled: false } });
  await page.goto(appointment.url);
  await expect(page.getByText(appointment.publicCode, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar cancelación" })).toHaveCount(0);
});
