import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const target = resolveTestDataTarget({ profile: "development", env: { ...process.env, NODE_ENV: "test" } });
const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
const username = `ds-${randomUUID().slice(0, 8)}`;
const password = `Design-fixture-${randomUUID()}`;
const userIds: string[] = [];

test.beforeAll(async () => {
  if (!target.allowed) return;
  const passwordHash = await createPasswordHash(password);
  for (const role of ["ADMIN", "STAFF"] as const) {
    const user = await prisma.user.create({ data: { username: `${username}-${role.toLowerCase()}`, email: `${username}-${role}@test.invalid`, name: "Referencia visual", passwordHash, role } });
    userIds.push(user.id);
  }
});
test.beforeEach(() => { if (!target.allowed) test.skip(true, target.message); });
test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.loginThrottle.deleteMany({ where: { key: { in: [`user:${username}-admin`, `user:${username}-staff`] } } });
  await prisma.$disconnect();
});

async function login(page: Page, role: "admin" | "staff") {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(`${username}-${role}`);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
}

test("visual reference requires a signed-in administrator", async ({ page }) => {
  await page.goto("/internal/design-system");
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
  await login(page, "staff");
  await page.goto("/internal/design-system");
  await expect(page).toHaveURL(/\/internal\?feedback=forbidden$/);
});

test("visual reference presents accessible errors, pending actions and real navigation", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/internal/design-system");
  await expect(page.getByRole("heading", { name: "Sistema de diseño" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: false })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email", { exact: false })).toHaveAttribute("aria-describedby", "example-email-error");
  await expect(page.getByRole("button", { name: "Guardando" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const nav = page.getByRole("navigation", { name: "Ejemplo de navegación" });
  await nav.getByRole("link", { name: "Reservas y señas" }).click();
  const realNav = page.getByRole("navigation", { name: "Secciones de configuración" });
  await expect(realNav.getByRole("link", { name: "Reservas y señas" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
});
