import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
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
let fixtureUserId: string | undefined;
let username: string;
const originalPassword = `E2E-cuenta-${randomUUID()}`;
const newPassword = `E2E-nueva-${randomUUID()}`;

test.beforeEach(async () => {
  if (!target.allowed) test.skip(true, target.message);
  // Un usuario por prueba: el cambio de contraseña no debe afectar a la otra corrida.
  username = `e2e-account-${randomUUID().slice(0, 8)}`;
  fixtureUserId = (await prisma.user.create({
    data: { email: `${username}@test.invalid`, username, name: "Cuenta E2E", passwordHash: await createPasswordHash(originalPassword) },
    select: { id: true },
  })).id;
});

test.afterEach(async () => {
  if (fixtureUserId) await prisma.user.delete({ where: { id: fixtureUserId } });
  fixtureUserId = undefined;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("el usuario interno cambia su contraseña y entra con la nueva", async ({ page }) => {
  test.slow();
  await login(page, originalPassword);
  await page.getByRole("navigation", { name: "Secciones del panel" }).getByRole("link", { name: "Mi cuenta" }).click();
  // La primera visita compila la ruta en desarrollo.
  await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible({ timeout: 30_000 });

  await fillPasswordForm(page, "incorrecta-000", newPassword, newPassword);
  // Next suma su propio anunciador de rutas con role="alert": se filtra por texto.
  await expect(page.getByRole("alert").filter({ hasText: "La contraseña actual no es correcta." })).toBeVisible();

  await fillPasswordForm(page, originalPassword, newPassword, newPassword);
  await expect(page.getByRole("status").filter({ hasText: "Contraseña actualizada" })).toBeVisible();
  await expect(page.getByLabel("Contraseña actual")).toHaveValue("");

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();

  await submitLogin(page, originalPassword);
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();

  await login(page, newPassword);
});

test("Mi cuenta requiere sesión", async ({ page }) => {
  await page.goto("/internal/account");
  await expect(page).toHaveURL(/\/internal\/login/);
});

async function submitLogin(page: Page, password: string) {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

async function login(page: Page, password: string) {
  await submitLogin(page, password);
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });
}

async function fillPasswordForm(page: Page, current: string, next: string, confirm: string) {
  await page.getByLabel("Contraseña actual").fill(current);
  await page.getByLabel("Contraseña nueva", { exact: false }).first().fill(next);
  await page.getByLabel("Repetir contraseña nueva").fill(confirm);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
}
