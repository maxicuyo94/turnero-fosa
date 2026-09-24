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
const fixturePrefix = `E2E-E2-${randomUUID().slice(0, 8).toUpperCase()}-`;
const fixtureUsername = `e2e-count-${randomUUID().slice(0, 8)}`;
const fixturePassword = `E2E-count-${randomUUID()}`;
let fixtureUserId: string | undefined;
let location: string;

test.beforeAll(async () => {
  if (!target.allowed) return;
  fixtureUserId = (await prisma.user.create({
    data: { email: `${fixtureUsername}@test.invalid`, username: fixtureUsername, name: "Conteo E2E", passwordHash: await createPasswordHash(fixturePassword) },
    select: { id: true },
  })).id;
});

test.beforeEach(async () => {
  if (!target.allowed) test.skip(true, target.message);
  location = `${fixturePrefix}${randomUUID().slice(0, 6)}`;
});

test.afterEach(async () => {
  if (target.allowed) await cleanupFixtures();
});

test.afterAll(async () => {
  if (fixtureUserId) await prisma.user.delete({ where: { id: fixtureUserId } });
  await prisma.$disconnect();
});

test("imprime etiquetas con Code 128 para SKU cortos y QR para los automáticos", async ({ page }) => {
  const short = await product("Filtro etiqueta", 2, `E2E-${randomUUID().slice(0, 8).toUpperCase()}`);
  await product("Bujía etiqueta", 1, `REP-${randomUUID().replaceAll("-", "").toUpperCase()}`);

  await login(page);
  await page.goto(`/internal/shop/inventory?${new URLSearchParams({ location })}`);
  await page.getByRole("link", { name: "Imprimir etiquetas" }).click();
  await expect(page.getByRole("heading", { name: "Etiquetas internas" })).toBeVisible();
  const labels = page.getByRole("list", { name: "Etiquetas" }).getByRole("listitem");
  await expect(labels).toHaveCount(2);
  await expect(page.getByRole("img", { name: `Código de barras ${short.sku}` })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Código QR REP-/u })).toBeVisible();

  await page.getByLabel("Copias por repuesto").fill("3");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(labels).toHaveCount(6);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath(`labels-${test.info().project.name}.png`), fullPage: true });
});

test("cuenta desde el código, pide recontar lo que se movió y aplica solo lo revisado", async ({ page }) => {
  test.slow();
  const filter = await product("Filtro conteo", 5);
  const chain = await product("Cadena conteo", 3);

  await login(page);
  await page.goto("/internal/shop/counts");
  await page.getByLabel("Qué contar").selectOption(location);
  await page.getByRole("button", { name: "Empezar conteo" }).click();
  await expect(page.getByRole("heading", { name: `Conteo de ${location}` })).toBeVisible();

  // Un codigo leido abre la carga de ese repuesto; contar no cambia el stock.
  await page.getByLabel("Código o SKU").fill(filter.sku);
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByLabel("Unidades contadas", { exact: true }).fill("4");
  await page.getByLabel("Contar un repuesto").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cantidad guardada.")).toBeVisible();
  expect((await prisma.shopProduct.findUniqueOrThrow({ where: { id: filter.id } })).stock).toBe(5);

  await saveLine(page, chain.name, "3");

  // Una entrada durante el conteo bloquea la aplicacion hasta recontar.
  await prisma.shopProduct.update({ where: { id: filter.id }, data: { stock: 6, version: { increment: 1 } } });
  await prisma.inventoryMovement.create({ data: { productId: filter.id, kind: "RECEIPT", quantityDelta: 1, stockBefore: 5, stockAfter: 6, reason: "Durante el conteo", requestKey: randomUUID(), requestFingerprint: "e2e" } });
  await page.reload();
  await expect(page.getByText("Se movió durante el conteo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aplicar ajustes" })).toBeDisabled();
  await page.getByRole("button", { name: "Recontar" }).click();
  await expect(page.getByText("Base actualizada")).toBeVisible();
  await saveLine(page, filter.name, "4");

  await page.getByRole("link", { name: /Con diferencia · 1/u }).click();
  await expect(page.getByLabel("Líneas del conteo").getByRole("listitem")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath(`count-${test.info().project.name}.png`), fullPage: true });

  await page.getByLabel("Motivo del ajuste").fill("Conteo E2E");
  await page.getByRole("button", { name: "Aplicar ajustes" }).click();
  await expect(page.getByText("Conteo aplicado.")).toBeVisible();
  expect((await prisma.shopProduct.findUniqueOrThrow({ where: { id: filter.id } })).stock).toBe(4);
  expect((await prisma.shopProduct.findUniqueOrThrow({ where: { id: chain.id } })).stock).toBe(3);
  expect(await prisma.inventoryMovement.count({ where: { productId: filter.id, kind: "ADJUSTMENT" } })).toBe(1);
  await expect(page.getByRole("button", { name: "Aplicar ajustes" })).toHaveCount(0);
});

async function saveLine(page: Page, name: string, quantity: string) {
  const input = page.getByLabel(`Unidades contadas de ${name}`);
  await input.fill(quantity);
  await input.press("Enter");
  await expect(page.getByText("Cantidad guardada.")).toBeVisible();
  await expect(page.getByLabel(`Unidades contadas de ${name}`)).toHaveValue(quantity);
}

async function product(name: string, stock: number, sku = `${fixturePrefix}${randomUUID().slice(0, 8)}`) {
  const created = await prisma.shopProduct.create({ data: { sku, name: `${fixturePrefix}${name}`, category: "E2E", location, priceCents: 10_000, stock } });
  await prisma.inventoryMovement.create({ data: { productId: created.id, kind: "INITIAL", quantityDelta: stock, stockBefore: 0, stockAfter: stock, reason: "Stock inicial", requestKey: randomUUID(), requestFingerprint: "e2e" } });
  return created;
}

async function login(page: Page) {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(fixtureUsername);
  await page.getByLabel("Contraseña").fill(fixturePassword);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function cleanupFixtures() {
  const products = await prisma.shopProduct.findMany({ where: { name: { startsWith: fixturePrefix } }, select: { id: true } });
  const ids = products.map(({ id }) => id);
  await prisma.stockCount.deleteMany({ where: { OR: [{ lines: { some: { productId: { in: ids } } } }, ...(fixtureUserId ? [{ openedById: fixtureUserId }] : [])] } });
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
  await prisma.shopProduct.deleteMany({ where: { id: { in: ids } } });
}
