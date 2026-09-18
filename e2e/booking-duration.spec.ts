import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const fixtureUsername = `e2e-booking-${randomUUID().slice(0, 8)}`;
const fixturePassword = `E2E-booking-${randomUUID()}`;
let fixtureUserId: string | undefined;
let shortService: { name: string; durationMinutes: number };
let longService: { name: string; durationMinutes: number };

test.beforeAll(async () => {
  if (!target.allowed) return;
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { name: true, durationMinutes: true },
  });
  shortService = services[0];
  longService = services.find((service) => service.durationMinutes !== services[0]?.durationMinutes)!;
  const user = await prisma.user.create({
    data: {
      email: `${fixtureUsername}@test.invalid`,
      username: fixtureUsername,
      name: "Reservas E2E",
      passwordHash: await createPasswordHash(fixturePassword),
    },
    select: { id: true },
  });
  fixtureUserId = user.id;
});

test.beforeEach(async () => {
  if (!target.allowed) test.skip(true, target.message);
  test.skip(!longService, "Se necesitan dos servicios activos con duraciones distintas.");
});

test.afterAll(async () => {
  if (fixtureUserId) await prisma.user.delete({ where: { id: fixtureUserId } });
  await prisma.$disconnect();
});

test("el visitante no edita la duracion y el cambio de servicio la actualiza", async ({ page }) => {
  await page.goto("/booking");
  await expect(page.getByRole("heading", { name: "Reservar turno" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /Duracion total/ })).toHaveCount(0);
  await expect(page.getByText(summaryPattern(shortService))).toBeVisible();

  await page.getByLabel("Servicio").selectOption({ label: `${longService.name} - ${longService.durationMinutes} min` });
  await page.getByRole("button", { name: "Ver", exact: true }).click();

  await expect(page.getByText(summaryPattern(longService))).toBeVisible();
});

test("el visitante no puede forzar la duracion desde la URL", async ({ page }) => {
  const forcedDuration = shortService.durationMinutes + 120;
  await page.goto(`/booking?durationMinutes=${forcedDuration}`);

  await expect(page.getByText(summaryPattern(shortService))).toBeVisible();
  await expect(page.getByText(`${forcedDuration} min ·`)).toHaveCount(0);
});

test("la sesion interna edita la duracion y la reajusta al cambiar de servicio", async ({ page }) => {
  test.slow();
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(fixtureUsername);
  await page.getByLabel("Contraseña").fill(fixturePassword);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/booking");
  const duration = page.getByRole("spinbutton", { name: /Duracion total/ });
  await expect(duration).toHaveValue(String(shortService.durationMinutes));

  // La regresion: el filtro reenviaba la duracion del servicio anterior.
  await page.getByLabel("Servicio").selectOption({ label: `${longService.name} - ${longService.durationMinutes} min` });
  await expect(duration).toHaveValue(String(longService.durationMinutes));

  const stretched = longService.durationMinutes + 30;
  await duration.fill(String(stretched));
  await page.getByRole("button", { name: "Ver", exact: true }).click();

  await expect(page.getByText(summaryPattern(longService, stretched))).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /Duracion total/ })).toHaveValue(String(stretched));
});

function summaryPattern(service: { name: string; durationMinutes: number }, durationMinutes?: number): RegExp {
  return new RegExp(`${service.name} · ${durationMinutes ?? service.durationMinutes} min ·`);
}
