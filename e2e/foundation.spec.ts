import "dotenv/config";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/src/lib/env";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
const e2eEmailPrefix = "e2e-rider";

test.beforeEach(async () => {
  await cleanupPublicBookingE2EData();
});

test.afterEach(async () => {
  await cleanupPublicBookingE2EData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("foundation routes are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Taller de motos Express" })).toBeVisible();

  await page.getByRole("link", { name: "Ir a reservar →" }).click();
  await expect(page.getByRole("heading", { name: "Reservar turno" })).toBeVisible();

  await page.goto("/internal");
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
});

test("public booking happy path creates a pending request", async ({ page }) => {
  const runId = Date.now().toString(36);

  await page.goto("/booking?date=2026-07-06");

  await page.getByRole("radio").first().check();
  await page.getByLabel("Nombre y apellido").fill("E2E Rider");
  await page.getByLabel("Telefono").fill("+5491100000000");
  await page.getByLabel("Email").fill(`${e2eEmailPrefix}-${runId}@example.com`);
  await page.getByLabel("Marca de la moto").fill("Honda");
  await page.getByLabel("Modelo").fill("XR150");
  await page.getByRole("button", { name: "Solicitar turno" }).click();

  await expect(page.getByText("Tu turno quedo confirmado automaticamente.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Guardar enlace de cancelacion" })).toHaveCount(0);
  await expect(page.getByText("La reprogramacion online no esta disponible por ahora.")).toBeVisible();
});

async function cleanupPublicBookingE2EData() {
  const appointments = await prisma.appointment.findMany({
    where: { customer: { email: { startsWith: e2eEmailPrefix } } },
    select: { id: true, motorcycleId: true, customerId: true },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const motorcycleIds = appointments.map((appointment) => appointment.motorcycleId);
  const customerIds = appointments.map((appointment) => appointment.customerId);

  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.motorcycle.deleteMany({ where: { id: { in: motorcycleIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}
