import "dotenv/config";
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";
import { ean13, writeBarcodeVideo } from "./helpers/barcode-video";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const fixturePrefix = `E2E-E2-${randomUUID().slice(0, 8).toUpperCase()}-`;
const fixtureUsername = `e2e-code-${randomUUID().slice(0, 8)}`;
const fixturePassword = `E2E-code-${randomUUID()}`;
// Codigo que muestra la camara falsa; unico por corrida para no chocar con datos locales.
const cameraCode = ean13(`779${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`);
let fixtureUserId: string | undefined;

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${writeBarcodeVideo(cameraCode)}`,
    ],
  },
});

test.beforeAll(async () => {
  if (!target.allowed) return;
  const user = await prisma.user.create({
    data: {
      email: `${fixtureUsername}@test.invalid`,
      username: fixtureUsername,
      name: "Escaneo E2E",
      passwordHash: await createPasswordHash(fixturePassword),
    },
    select: { id: true },
  });
  fixtureUserId = user.id;
});

test.beforeEach(async () => {
  if (!target.allowed) test.skip(true, target.message);
  await cleanupFixtures();
});

test.afterEach(async () => {
  if (target.allowed) await cleanupFixtures();
});

test.afterAll(async () => {
  if (fixtureUserId) await prisma.user.delete({ where: { id: fixtureUserId } });
  await prisma.$disconnect();
});

test("la cámara lee un código de barras y abre la ficha sin tocar el stock", async ({ page }) => {
  test.slow();
  const product = await createProduct({ sku: `${fixturePrefix}CAMARA`, barcode: cameraCode, stock: 7 });
  await login(page);
  await page.goto("/internal/shop/inventory");

  const wasm = page.waitForResponse((response) => response.url().includes("/vendor/zxing_reader-"));
  await page.getByRole("button", { name: "Escanear con cámara" }).click();

  expect((await wasm).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${product.id}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 7, version: 0 });
  expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(0);
});

test("buscar un código escrito abre la ficha, también por SKU", async ({ page }) => {
  const product = await createProduct({ sku: `${fixturePrefix}MANUAL`, barcode: `${fixturePrefix}0042` });
  await login(page);

  await searchCode(page, `${fixturePrefix}0042`);
  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${product.id}$`));

  await searchCode(page, `${fixturePrefix}manual`.toLowerCase());
  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${product.id}$`));
});

test("encuentra códigos cargados con espacios y sugiere los casi iguales", async ({ page }) => {
  const digits = ean13(`778${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`);
  const spaced = await createProduct({ sku: `${fixturePrefix}ESPACIOS`, barcode: `${digits[0]} ${digits.slice(1, 7)} ${digits.slice(7)}` });
  await login(page);

  await searchCode(page, digits);
  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${spaced.id}$`));

  // Ficha cargada sin el digito verificador: no se abre sola, pero se sugiere.
  const other = ean13(`776${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`);
  const typo = await createProduct({ sku: `${fixturePrefix}CASI`, barcode: other.slice(0, 12) });
  await searchCode(page, other);
  await expect(page.getByRole("heading", { name: "Código no registrado" })).toBeVisible();
  await expect(page.getByLabel("Códigos parecidos", { exact: true }).getByRole("link", { name: new RegExp(typo.name) })).toBeVisible();
});

test("un código desconocido se vincula a un repuesto sin código", async ({ page }) => {
  const product = await createProduct({ sku: `${fixturePrefix}SIN-CODIGO`, barcode: null });
  const code = `${fixturePrefix}NUEVO`;
  await login(page);

  await searchCode(page, code);
  await expect(page.getByRole("heading", { name: "Código no registrado" })).toBeVisible();
  await page.getByLabel("Buscar repuestos sin código").fill(product.sku);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const linkCard = page.getByLabel("Vincular a un repuesto existente", { exact: true });
  await linkCard.getByRole("listitem").filter({ hasText: product.name }).getByRole("button", { name: "Vincular" }).click();

  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${product.id}\\?linked=1$`));
  await expect(page.getByText("Código vinculado.")).toBeVisible();
  expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ barcode: code });

  await searchCode(page, code);
  await expect(page).toHaveURL(new RegExp(`/internal/shop/inventory/${product.id}$`));
});

test("un código desconocido abre el alta con el código precargado", async ({ page }) => {
  const code = `${fixturePrefix}ALTA`;
  await login(page);

  await searchCode(page, code);
  await page.getByRole("link", { name: "Crear con este código" }).click();

  await expect(page.locator("#new-barcode")).toHaveValue(code);
  await expect(page.locator("#new-name")).toHaveValue("");
});

test("solo el área interna publica el manifiesto instalable", async ({ page, request }) => {
  await page.goto("/internal/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/internal.webmanifest");

  const manifest = await request.get("/internal.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({ start_url: "/internal", scope: "/internal", display: "standalone" });

  await page.goto("/booking");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});

async function login(page: Page) {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(fixtureUsername);
  await page.getByLabel("Contraseña").fill(fixturePassword);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });
}

async function searchCode(page: Page, code: string) {
  await page.goto("/internal/shop/inventory");
  await page.getByLabel("Código", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Buscar código" }).click();
}

async function createProduct({ sku, barcode, stock = 0 }: { sku: string; barcode: string | null; stock?: number }) {
  return prisma.shopProduct.create({
    data: { sku, barcode, name: `Repuesto ${sku}`, category: "Pruebas E2", priceCents: 1000, stock },
  });
}

async function cleanupFixtures() {
  await prisma.shopProduct.deleteMany({ where: { OR: [{ sku: { startsWith: fixturePrefix } }, { barcode: cameraCode }] } });
}
