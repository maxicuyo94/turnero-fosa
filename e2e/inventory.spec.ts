import "dotenv/config";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
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
const fixturePrefix = `E2E-E1-${randomUUID().slice(0, 8).toUpperCase()}-`;
const fixtureUsername = `e2e-inventory-${randomUUID().slice(0, 8)}`;
const fixturePassword = `E2E-inventory-${randomUUID()}`;
let fixtureUserId: string | undefined;

test.beforeAll(async () => {
  if (!target.allowed) return;
  const user = await prisma.user.create({
    data: {
      email: `${fixtureUsername}@test.invalid`,
      username: fixtureUsername,
      name: "Inventario E2E",
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

test("el acceso anónimo al inventario interno requiere autenticación", async ({ page }) => {
  await page.goto("/internal/shop/inventory");
  await expect(page).toHaveURL(/\/internal\/login/);
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
});

test("importa Excel, informa filas inválidas y bloquea la carga repetida", async ({ page }) => {
  test.slow();
  await loginAsFixtureUser(page);
  await page.goto("/internal/shop/inventory");
  const card = page.getByLabel("Importar inventario desde Excel", { exact: true });
  const downloadPromise = page.waitForEvent("download");
  await card.getByRole("link", { name: "Descargar plantilla" }).click();
  const download = await downloadPromise;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  const productName = `${fixturePrefix}Filtro Excel`;
  const sheet = workbook.getWorksheet("Carga")!;
  sheet.getRow(5).values = [];
  sheet.getRow(15).values = ["", "", productName, "Filtros", "", "", "", 1250.50, -1, 1, "A-1", "Sí"];
  async function upload() {
    await card.getByLabel("Archivo Excel").setInputFiles({ name: "carga.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    await card.getByRole("button", { name: "Importar productos" }).click();
  }
  await upload();
  await expect(card).toContainText("Fila 15");
  expect(await prisma.shopProduct.count({ where: { name: productName } })).toBe(0);
  sheet.getRow(15).getCell(9).value = 3;
  await upload();
  await expect(card).toContainText("Importamos 1 repuesto y 3 unidades iniciales.");
  const product = await prisma.shopProduct.findFirstOrThrow({ where: { name: productName }, include: { movements: true } });
  expect(product.sku).toMatch(/^REP-[A-F0-9]{24}$/u);
  expect(product).toMatchObject({ priceCents: 125050, stock: 3 });
  expect(product.movements).toHaveLength(1);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await upload();
  await expect(card).toContainText("Ya existe un producto");
  expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
  await expectNoHorizontalOverflow(page);
  await card.screenshot({ path: test.info().outputPath(`excel-${test.info().project.name}.png`) });
});

test("el personal crea, edita y registra entrada, consumo y ajuste sin recargar", async ({ page }) => {
  test.slow();
  const sku = `${fixturePrefix}UI`;
  const barcode = `779${Date.now().toString().slice(-9)}`;

  await loginAsFixtureUser(page);
  await page.goto("/internal/shop/inventory");
  await expect(page.getByRole("heading", { name: "Repuestos" })).toBeVisible();

  const newProduct = page.locator('[aria-label="Nuevo repuesto"]');
  await newProduct.getByLabel("Nombre").fill("Pastillas E2E inventario");
  await newProduct.getByLabel("SKU").fill(sku);
  await newProduct.getByLabel("Código de barras").fill(`  ${barcode} `);
  await newProduct.getByLabel("Categoría").fill("Frenos");
  await newProduct.getByLabel("Marca").fill("Honda");
  await newProduct.getByLabel("Precio (ARS)").fill("1250,50");
  await newProduct.getByLabel("Stock mínimo").fill("1");
  await newProduct.getByLabel("Stock físico inicial").fill("1");
  await newProduct.getByLabel("Ubicación").fill("E2E-A1");
  await newProduct.getByLabel("Compatibilidad").fill("Wave 110");
  await newProduct.getByRole("button", { name: "Crear repuesto" }).click();
  await expect(newProduct).toContainText(/Guardamos|creado|correctamente/u);
  await newProduct.getByRole("link", { name: "Abrir ficha" }).click();

  await expect(page.getByRole("heading", { name: "Pastillas E2E inventario" })).toBeVisible();
  await expect(page.locator("ol li").filter({ hasText: "Stock inicial" })).toBeVisible();
  const productForm = page.locator('[aria-label="Editar ficha"]');
  await productForm.getByLabel("Nombre").fill("Pastillas E2E editadas");
  await productForm.getByLabel("Ubicación").fill("E2E-B2");
  await productForm.getByLabel("Precio (ARS)").fill("1300,00");
  await productForm.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(productForm).toContainText(/Guardamos|actualiz|correctamente/u);
  await expect(page.getByRole("heading", { name: "Pastillas E2E editadas" })).toBeVisible();
  await expect(productForm.getByRole("button", { name: "Guardar ficha" })).toBeEnabled();

  const movement = page.locator('[aria-label="Registrar movimiento"]');
  await movement.getByLabel("Tipo").selectOption("RECEIPT");
  await movement.getByLabel("Cantidad").fill("2");
  await movement.getByLabel("Motivo").fill("Ingreso E2E");
  await movement.getByLabel("Referencia").fill("REM-E2E");
  await submitMovement(movement);
  await expectProduct(sku, { stock: 3, version: 2 });

  await movement.getByLabel("Tipo").selectOption("REPAIR");
  await movement.getByLabel("Cantidad").fill("4");
  await movement.getByLabel("Motivo").fill("Consumo E2E insuficiente");
  await movement.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(movement).toContainText("No hay stock disponible suficiente para registrar el consumo.");
  await expect(movement.getByRole("button", { name: "Registrar movimiento" })).toBeEnabled();
  await expect(movement.getByLabel("Cantidad")).toHaveValue("4");
  await expect(movement.getByLabel("Motivo")).toHaveValue("Consumo E2E insuficiente");

  await movement.getByLabel("Tipo").selectOption("REPAIR");
  await movement.getByLabel("Cantidad").fill("1");
  await movement.getByLabel("Motivo").fill("Consumo E2E válido");
  await submitMovement(movement);
  await expectProduct(sku, { stock: 2, version: 3 });

  await movement.getByLabel("Tipo").selectOption("ADJUSTMENT");
  await movement.getByLabel("Cantidad").fill("4");
  await movement.getByLabel("Motivo").fill("Conteo E2E");
  await movement.getByLabel("Referencia").fill("CONTEO-E2E");
  await submitMovement(movement);

  await expect(movement.getByRole("button", { name: "Registrar movimiento" })).toBeEnabled();
  await expect.poll(async () => {
    const product = await prisma.shopProduct.findUnique({ where: { sku } });
    return product ? { name: product.name, location: product.location, priceCents: product.priceCents, stock: product.stock, reservedStock: product.reservedStock, version: product.version } : null;
  }).toEqual({ name: "Pastillas E2E editadas", location: "E2E-B2", priceCents: 130000, stock: 4, reservedStock: 0, version: 4 });

  const history = await prisma.inventoryMovement.findMany({
    where: { product: { sku } },
    orderBy: { createdAt: "asc" },
    select: { kind: true, reason: true, quantityDelta: true, stockAfter: true },
  });
  expect(history).toEqual([
    { kind: "INITIAL", reason: "Stock inicial", quantityDelta: 1, stockAfter: 1 },
    { kind: "RECEIPT", reason: "Ingreso E2E", quantityDelta: 2, stockAfter: 3 },
    { kind: "REPAIR", reason: "Consumo E2E válido", quantityDelta: -1, stockAfter: 2 },
    { kind: "ADJUSTMENT", reason: "Conteo E2E", quantityDelta: 2, stockAfter: 4 },
  ]);
  const stockSection = page.locator('[aria-label="Stock actual"]');
  await expect(stockSection.getByText("Físico", { exact: true }).locator("..")).toContainText("4");
  await expect(page.locator("ol li").filter({ hasText: "Conteo E2E" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-${test.info().project.name}.png`), fullPage: true });
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-${test.info().project.name}-viewport.png`) });
});

test("permite tres altas consecutivas y refleja búsqueda, filtros y resumen real", async ({ page }) => {
  test.slow();
  await loginAsFixtureUser(page);
  await page.goto("/internal/shop/inventory");
  const newProduct = page.locator('[aria-label="Nuevo repuesto"]');
  const products = [
    { name: "Rotación E2E 1", stock: "0", location: "ROT-A1" },
    { name: "Rotación E2E 2", stock: "1", location: "ROT-A2" },
    { name: "Rotación E2E 3", stock: "2", location: "ROT-A3" },
  ].map((product) => ({ ...product, sku: `${fixturePrefix}${product.location}`, barcode: `779${randomUUID().replaceAll("-", "").slice(0, 9)}` }));

  for (const product of products) {
    await fillNewProduct(newProduct, product);
    await submitCreate(newProduct);
  }

  expect(await prisma.shopProduct.count({ where: { sku: { startsWith: fixturePrefix } } })).toBe(3);
  expect(new Set(await prisma.shopProduct.findMany({ where: { sku: { startsWith: fixturePrefix } }, select: { id: true } }).then((rows) => rows.map((row) => row.id))).size).toBe(3);

  await page.getByLabel("Buscar repuesto").fill("Rotación E2E 2");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByText("Rotación E2E 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Rotación E2E 1", { exact: true })).toHaveCount(0);
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-list-${test.info().project.name}.png`), fullPage: true });
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-list-${test.info().project.name}-viewport.png`) });
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Buscar repuesto").fill("");
  await page.getByLabel("Estado").selectOption("low");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByText("Rotación E2E 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Rotación E2E 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Rotación E2E 3", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/internal/shop");
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
  const allProducts = await prisma.shopProduct.findMany();
  const summary = page.locator('[aria-label="Resumen de inventario"]');
  const metrics = {
    Repuestos: allProducts.length,
    "Unidades físicas": allProducts.reduce((sum, item) => sum + item.stock, 0),
    "Para revisar": allProducts.filter((item) => item.stock - item.reservedStock <= item.minimumStock).length,
    Disponibilidad: allProducts.reduce((sum, item) => sum + item.stock - item.reservedStock, 0),
  };
  for (const [label, count] of Object.entries(metrics)) {
    await expect(summary.getByText(label, { exact: true }).locator("..").locator("p").nth(1))
      .toHaveText(new Intl.NumberFormat("es-AR").format(count));
  }
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-dashboard-${test.info().project.name}.png`), fullPage: true });
  await page.screenshot({ caret: "initial", path: test.info().outputPath(`inventory-dashboard-${test.info().project.name}-viewport.png`) });
  await expectNoHorizontalOverflow(page);
});

async function submitMovement(form: import("@playwright/test").Locator) {
  const key = await form.locator('[name="requestKey"]').inputValue();
  await form.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(form.locator('[name="requestKey"]')).not.toHaveValue(key);
  await expect(form.getByRole("button", { name: "Registrar movimiento" })).toBeEnabled();
  await expect(form).toContainText("Movimiento registrado.");
}

async function expectProduct(sku: string, expected: { stock: number; version: number }) {
  await expect.poll(() => prisma.shopProduct.findUnique({ where: { sku }, select: { stock: true, version: true } })).toEqual(expected);
}

async function fillNewProduct(form: import("@playwright/test").Locator, product: { name: string; sku: string; barcode: string; stock: string; location: string }) {
  await form.getByLabel("Nombre").fill(product.name);
  await form.getByLabel("SKU").fill(product.sku);
  await form.getByLabel("Código de barras").fill(product.barcode);
  await form.getByLabel("Categoría").fill("Pruebas E2E");
  await form.getByLabel("Precio (ARS)").fill("1250,50");
  await form.getByLabel("Stock mínimo").fill("1");
  await form.getByLabel("Stock físico inicial").fill(product.stock);
  await form.getByLabel("Ubicación").fill(product.location);
}

async function submitCreate(form: import("@playwright/test").Locator) {
  const key = await form.locator('[name="requestKey"]').inputValue();
  await form.getByRole("button", { name: "Crear repuesto" }).click();
  await expect(form.locator('[name="requestKey"]')).not.toHaveValue(key);
  await expect(form.getByRole("button", { name: "Crear repuesto" })).toBeEnabled();
  await expect(form).toContainText("Repuesto cargado correctamente.");
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function loginAsFixtureUser(page: import("@playwright/test").Page) {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario").fill(fixtureUsername);
  await page.getByLabel("Contraseña").fill(fixturePassword);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 30_000 });
}

async function cleanupFixtures() {
  const products = await prisma.shopProduct.findMany({ where: { OR: [{ sku: { startsWith: fixturePrefix } }, ...(fixtureUserId ? [{ movements: { some: { actorId: fixtureUserId } } }] : [])] }, select: { id: true } });
  const productIds = products.map(({ id }) => id);
  if (productIds.length === 0) return;
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.shopProduct.deleteMany({ where: { id: { in: productIds } } });
}
