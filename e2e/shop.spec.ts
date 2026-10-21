import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type ShopSettings } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";
import { createPasswordHash } from "@/src/lib/password";
import { applyShopPayment } from "@/src/modules/shop/order-service";

const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({ profile: "development", env: { ...process.env, NODE_ENV: "test" } });
const prefix = `E2E-SHOP-${randomUUID().slice(0, 8)}`;
const username = prefix.toLowerCase();
const password = randomUUID();
let productId: string;
let userId: string;
let originalConfig: ShopSettings | null;

test.beforeAll(async () => {
  if (!target.allowed) return;
  originalConfig = await prisma.shopSettings.findUnique({ where: { id: "shop" } });
  userId = (await prisma.user.create({ data: { username, email: `${prefix}@test.invalid`, passwordHash: await createPasswordHash(password), role: "ADMIN" } })).id;
  const config = { checkoutEnabled: true, shippingEnabled: true, shippingFeeCents: 50000, shippingPostalCodes: ["4400"], pickupInstructions: "Taller de prueba · Calle 123 · de 9 a 18" };
  await prisma.shopSettings.upsert({ where: { id: "shop" }, create: { id: "shop", ...config }, update: config });
  productId = (await prisma.shopProduct.create({ data: { sku: `${prefix}-FILTER`, name: `${prefix} Filtro de aceite`, category: "Filtros", brand: "Marca prueba", compatibility: "Moto 150 cc", priceCents: 125050, stock: 5, isPublished: true } })).id;
  await prisma.shopProduct.create({ data: { sku: `${prefix}-HIDDEN`, name: `${prefix} Oculto`, category: "Filtros", priceCents: 10000, stock: 2 } });
});
test.afterAll(async () => {
  if (target.allowed) {
    const orders = await prisma.shopOrder.findMany({ where: { items: { some: { product: { sku: { startsWith: prefix } } } } }, select: { id: true } });
    const ids = { in: orders.map((o) => o.id) };
    await prisma.shopOrderEvent.deleteMany({ where: { orderId: ids } });
    await prisma.shopPayment.deleteMany({ where: { orderId: ids } });
    await prisma.shopOrderItem.deleteMany({ where: { orderId: ids } });
    await prisma.shopOrder.deleteMany({ where: { id: ids } });
    await prisma.inventoryMovement.deleteMany({ where: { product: { sku: { startsWith: prefix } } } });
    await prisma.shopProduct.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.shopVehicleModel.deleteMany({ where: { brand: prefix.toUpperCase() } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (originalConfig) await prisma.shopSettings.update({ where: { id: "shop" }, data: originalConfig });
    else await prisma.shopSettings.deleteMany({ where: { id: "shop" } });
  }
  await prisma.$disconnect();
});
test.beforeEach(() => { if (!target.allowed) test.skip(true, target.message); });

async function login(page: Page) {
  await page.goto("/internal/login");
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/internal$/u);
}

test("public catalog hides unpublished products and protects order and management pages", async ({ page }) => {
  await page.goto("/shop");
  await page.getByLabel("Buscar repuesto").fill(prefix);
  await expect(page.getByRole("heading", { name: `${prefix} Filtro de aceite` })).toBeVisible();
  await expect(page.getByText(`${prefix} Oculto`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Repuestos", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto("/shop/order?token=invalid");
  await expect(page.getByText("No encontramos el pedido.", { exact: false })).toBeVisible();
  await page.goto("/internal/shop/orders");
  await expect(page).toHaveURL(/\/internal\/login/u);
  await page.goto("/internal/shop/store");
  await expect(page).toHaveURL(/\/internal\/login/u);
});

test("mechanic buys with shipping, persists cart and staff dispatches paid order only once", async ({ page }) => {
  test.skip(process.env.SHOP_E2E_PAYMENT !== "1", "Run against a local server with dummy Mercado Pago credentials; no real payment requests are made.");
  test.slow();
  await page.goto("/shop");
  await page.getByLabel("Buscar repuesto").fill(prefix);
  await page.getByRole("button", { name: `Agregar ${prefix} Filtro de aceite al carrito` }).click();
  await page.getByRole("link", { name: /^(Carrito|Ver carrito) \d/u }).click();
  await page.reload();
  await expect(page.getByLabel(`Cantidad de ${prefix} Filtro de aceite`)).toHaveValue("1");
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await page.getByLabel("Cómo lo recibís").selectOption("SHIPPING");
  await page.getByLabel("Código postal", { exact: true }).fill("4400");
  await page.getByLabel("Comprás como").selectOption("MECHANIC");
  await page.getByLabel("Nombre del taller").fill("Taller E2E");
  await page.getByLabel("Nombre y apellido").fill(`${prefix} Comprador`);
  await page.getByLabel("Email", { exact: true }).fill("buyer@test.invalid");
  await page.getByLabel("Teléfono", { exact: true }).fill("1155555555");
  await page.getByLabel("Dirección, altura y departamento").fill("Calle 123");
  await expect(page.getByLabel("Localidad")).toHaveValue("Salta");
  await expect(page.getByLabel("Localidad")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Provincia")).toHaveValue("Salta");
  await page.getByLabel("Código postal", { exact: true }).fill("4400");
  await page.screenshot({ path: test.info().outputPath(`cart-${test.info().project.name}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await page.getByRole("button", { name: "Confirmar pedido y continuar" }).click();
  await expect(page).toHaveURL(/\/shop\/order\?token=[a-f0-9]{64}$/u);
  await expect(page.getByRole("button", { name: "Pagar con Mercado Pago" })).toBeVisible();
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { fullName: `${prefix} Comprador` }, orderBy: { createdAt: "desc" } });
  expect(order).toMatchObject({ buyerKind: "MECHANIC", deliveryKind: "SHIPPING", totalCents: 175050, shippingFeeCents: 50000 });
  expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ reservedStock: 1 });
  await applyShopPayment(prisma, { id: randomUUID(), externalReference: `shop:${order.id}`, amount: 1750.5, currency: "ARS", status: "approved", statusDetail: "accredited", liveMode: false, approvedAt: new Date() }, false);
  await page.reload();
  await expect(page.getByText("Pago acreditado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar con Mercado Pago" })).toHaveCount(0);
  await login(page);
  await page.goto("/internal/shop/orders");
  const orderCard = page.getByRole("heading", { name: order.code, exact: true }).locator("xpath=../..").locator("..");
  await orderCard.getByLabel("Transportista y código de seguimiento").fill("Correo E2E · TRACK123");
  await orderCard.getByRole("button", { name: "Aplicar" }).click();
  await expect(orderCard.getByText("Enviado", { exact: true })).toBeVisible();
  expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ reservedStock: 0 });
  await orderCard.getByRole("button", { name: "Aplicar" }).click();
  await expect(orderCard.getByText("Entregado", { exact: true })).toBeVisible();
  expect(await prisma.inventoryMovement.count({ where: { requestKey: `shop-sale:${order.id}:${productId}` } })).toBe(1);
  await page.screenshot({ path: test.info().outputPath(`orders-${test.info().project.name}.png`), fullPage: true });
});

test("individual buys for pickup without entering a shipping address", async ({ page }) => {
  test.skip(process.env.SHOP_E2E_PAYMENT !== "1", "Needs local dummy payment configuration.");
  await page.goto("/shop");
  await page.getByLabel("Buscar repuesto").fill(prefix);
  await page.getByRole("button", { name: `Agregar ${prefix} Filtro de aceite al carrito` }).click();
  await page.getByRole("link", { name: /^(Carrito|Ver carrito) \d/u }).click();
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await page.getByLabel("Nombre y apellido").fill(`${prefix} Particular`);
  await page.getByLabel("Email", { exact: true }).fill("individual@test.invalid");
  await page.getByLabel("Teléfono", { exact: true }).fill("1166666666");
  await expect(page.getByLabel("Dirección, altura y departamento")).toHaveCount(0);
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await page.getByRole("button", { name: "Confirmar pedido y continuar" }).click();
  await expect(page).toHaveURL(/\/shop\/order\?token=[a-f0-9]{64}$/u);
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { fullName: `${prefix} Particular` } });
  expect(order).toMatchObject({ buyerKind: "INDIVIDUAL", deliveryKind: "PICKUP", totalCents: 125050, shippingFeeCents: 0, address: null });
});

test("admin publishes a product, configures shipping and staff cannot change store configuration", async ({ page }) => {
  test.slow();
  await login(page);
  await page.goto(`/internal/shop/inventory/${productId}`);
  await page.getByLabel("Publicado en la tienda").uncheck();
  await page.getByRole("button", { name: "Guardar publicación" }).click();
  await expect(page.getByText("Publicación actualizada.")).toBeVisible();
  expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ isPublished: false });
  await page.getByLabel("Publicado en la tienda").check();
  await page.getByRole("button", { name: "Guardar publicación" }).click();
  await expect(page.getByLabel("Publicado en la tienda")).toBeChecked();
  await page.goto("/internal/shop/store");
  await expect(page.getByRole("heading", { name: "Configuración de tienda", exact: true })).toBeVisible();
  await page.getByLabel("Costo fijo de envío en pesos").fill("750,25");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración de la tienda guardada.")).toBeVisible();
  expect(await prisma.shopSettings.findUnique({ where: { id: "shop" } })).toMatchObject({ shippingFeeCents: 75025 });
  await prisma.user.update({ where: { id: userId }, data: { role: "STAFF" } });
  await page.goto("/internal/shop/store");
  await expect(page).toHaveURL(/\/internal\?feedback=forbidden/u);
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
});

test("buyer reviews delivery, stock and contact before reserving a purchase", async ({ page }) => {
  await page.goto("/shop");
  await page.getByLabel("Buscar repuesto").fill(`${prefix} Filtro`);
  await page.getByRole("link", { name: `Ver ficha de ${prefix} Filtro de aceite` }).click();
  await expect(page.getByRole("heading", { name: `${prefix} Filtro de aceite`, exact:true })).toBeVisible();
  await page.getByRole("link", { name: "← Volver a repuestos" }).click();
  await expect(page.getByLabel("Buscar repuesto")).toHaveValue(`${prefix} Filtro`);
  await page.reload();
  await expect(page.getByLabel("Buscar repuesto")).toHaveValue(`${prefix} Filtro`);
  await page.getByRole("link", { name: `Ver ficha de ${prefix} Filtro de aceite` }).click();
  await page.getByRole("button", { name: `Agregar ${prefix} Filtro de aceite al carrito` }).click();
  await page.getByRole("link", { name: /^(Carrito|Ver carrito) \d/u }).click();
  const quantity = page.getByLabel(`Cantidad de ${prefix} Filtro de aceite`);
  await quantity.fill("6");
  await expect(page.getByText("Ingresá entre 1 y 5 unidades.")).toBeVisible();
  await quantity.fill("1");
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await page.getByLabel("Cómo lo recibís").selectOption("SHIPPING");
  await page.getByLabel("Código postal").fill("9999");
  await expect(page.getByText(/Todavía no enviamos a ese código postal/u)).toBeVisible();
  await expect(page.getByLabel("Nombre y apellido")).toHaveCount(0);
  await page.getByLabel("Código postal").fill("4400");
  await page.getByLabel("Dirección, altura y departamento").fill("Calle de prueba 123");
  await expect(page.getByLabel("Localidad")).toHaveValue("Salta");
  await expect(page.getByLabel("Localidad")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Provincia")).toHaveValue("Salta");
  await page.getByLabel("Nombre y apellido").fill(`${prefix} Revisión`);
  await page.getByLabel("Email", { exact:true }).fill("review@test.invalid");
  await page.getByLabel("Teléfono", { exact:true }).fill("1155555555");
  await page.reload();
  await page.getByRole("button", { name: "Elegir entrega" }).click();
  await expect(page.getByLabel("Cómo lo recibís")).toHaveValue("SHIPPING");
  await expect(page.getByLabel("Nombre y apellido")).toHaveValue(`${prefix} Revisión`);
  const actionBox = await page.getByRole("button", { name:"Revisar pedido" }).boundingBox();
  if (test.info().project.name === "mobile-chromium") {
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  await page.getByRole("button", { name:"Revisar pedido" }).click();
  await expect(page.getByRole("heading", { name:"Confirmá los datos de tu compra" })).toBeVisible();
  await expect(page.getByText("Calle de prueba 123", {exact:false}).last()).toBeVisible();
  expect(await prisma.shopOrder.count({where:{fullName:`${prefix} Revisión`}})).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`review-${test.info().project.name}.png`), fullPage:true });
});

test("workshop manages structured fitments used by the public motorcycle filter", async ({ page }) => {
  await login(page);
  await page.goto(`/internal/shop/inventory/${productId}`);
  await page.getByRole("button", { name:"Agregar modelo compatible" }).click();
  await page.locator("#fitment-0-brand").fill(prefix);
  await page.locator("#fitment-0-model").fill("MODELO E2E");
  await page.locator("#fitment-0-variant").fill("150");
  await page.locator("#fitment-0-yearFrom").fill("2024");
  await page.locator("#fitment-0-yearTo").fill("2020");
  await page.getByRole("button", { name:"Guardar fotos y compatibilidades" }).click();
  await expect(page.getByText("El año final debe ser igual o posterior al inicial.")).toBeVisible();
  await page.locator("#fitment-0-yearFrom").fill("2020");
  await page.locator("#fitment-0-yearTo").fill("2026");
  await page.getByRole("button", { name:"Guardar fotos y compatibilidades" }).click();
  await expect(page.getByText("Fotos y compatibilidades guardadas.")).toBeVisible();
  await page.goto("/shop");
  await page.getByText("Buscar por mi moto", {exact:true}).click();
  await page.getByLabel("Marca, modelo y versión").selectOption({label:`${prefix.toUpperCase()} MODELO E2E 150`});
  await page.getByLabel("Año", {exact:false}).fill("2019");
  await expect(page.getByText("No encontramos repuestos con esos filtros.")).toBeVisible();
  await page.getByLabel("Año", {exact:false}).fill("2023");
  await expect(page.getByRole("heading", {name:`${prefix} Filtro de aceite`,exact:true})).toBeVisible();
});
