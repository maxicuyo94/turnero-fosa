// @vitest-environment node
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient, type ShopSettings } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { reserveShopOrder, applyShopPayment, closeReviewedShopOrder, closeUnpaidOrder, fulfillShopOrder, reconcileShopOrder, startShopPayment } from "@/src/modules/shop/order-service";
import { publicCatalog, publicOrder } from "@/src/modules/shop/storefront-queries";
import { saveCatalogDetails } from "@/src/modules/shop/catalog-service";
import type { MercadoPagoPort, ProviderPayment } from "@/src/modules/payments/service";

const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
const prefix = `shop-test-${randomUUID()}`;
let originalConfig: ShopSettings | null;
let actorId: string;
let productId: string;
const input = (changes = {}) => ({ requestKey: randomUUID(), accessToken: randomBytes(32).toString("hex"),
  buyerKind: "MECHANIC", fullName: "Mecánico de prueba", email: "buyer@test.invalid", phone: "1155555555", workshopName: "Taller prueba",
  deliveryKind: "PICKUP", shippingFeeCents: 0, items: [{ productId, quantity: 1, unitPriceCents: 125050 }], ...changes });
const payment = (id: string, changes = {}): ProviderPayment => ({ id: randomUUID(), externalReference: `shop:${id}`, amount: 1250.5,
  currency: "ARS", status: "approved", statusDetail: "accredited", liveMode: false, approvedAt: new Date(), ...changes });
const port = (payments: ProviderPayment[] = []): MercadoPagoPort => ({ createPreference: vi.fn().mockResolvedValue({ preferenceId: "pref-1", checkoutUrl: "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=1" }),
  searchPayments: vi.fn().mockResolvedValue(payments), getPayment: vi.fn() });

async function cleanup() {
  const orders = await prisma.shopOrder.findMany({ where: { items: { some: { product: { sku: { startsWith: prefix } } } } }, select: { id: true } });
  const orderId = { in: orders.map((o) => o.id) };
  await prisma.shopOrderEvent.deleteMany({ where: { orderId } });
  await prisma.shopPayment.deleteMany({ where: { orderId } });
  await prisma.shopOrderItem.deleteMany({ where: { orderId } });
  await prisma.shopOrder.deleteMany({ where: { id: orderId } });
  await prisma.inventoryMovement.deleteMany({ where: { product: { sku: { startsWith: prefix } } } });
  await prisma.shopProduct.deleteMany({ where: { sku: { startsWith: prefix } } });
  await prisma.shopVehicleModel.deleteMany({ where: { brand: prefix.toUpperCase() } });
}

describe("shop orders with shared inventory", () => {
  beforeAll(async () => {
    originalConfig = await prisma.shopSettings.findUnique({ where: { id: "shop" } });
    actorId = (await prisma.user.create({ data: { email: `${prefix}@test.invalid` } })).id;
  });
  beforeEach(async () => {
    await cleanup();
    const settings = { checkoutEnabled: true, shippingEnabled: true, shippingFeeCents: 50000, shippingPostalCodes: ["4400"], pickupInstructions: "Dirección de prueba" };
    await prisma.shopSettings.upsert({ where: { id: "shop" }, create: { id: "shop", ...settings }, update: settings });
    productId = (await prisma.shopProduct.create({ data: { sku: `${prefix}-part`, name: "Filtro", category: "Filtros", priceCents: 125050, stock: 2, isPublished: true, location: "privada" } })).id;
  });
  afterAll(async () => {
    await cleanup();
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    if (originalConfig) await prisma.shopSettings.update({ where: { id: "shop" }, data: originalConfig });
    else await prisma.shopSettings.deleteMany({ where: { id: "shop" } });
    await prisma.$disconnect();
  });

  it("reserves once for a repeated or concurrent submission without consuming physical stock", async () => {
    const data = input();
    const results = await Promise.all([reserveShopOrder(prisma, data), reserveShopOrder(prisma, data)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 1 });
    expect(results[0]).toMatchObject({ buyerKind: "MECHANIC", totalCents: 125050, status: "AWAITING_PAYMENT" });
  });

  it("saves ordered images and shared model fitments atomically without changing stock or order prices", async () => {
    const order = await reserveShopOrder(prisma, input());
    const current = await prisma.shopProduct.findUniqueOrThrow({ where: { id: productId } });
    const details = { id: productId, version: current.version,
      images: [{ url: "/images/parts/filter.webp", alt: "Filtro de prueba" }],
      fitments: [{ brand: prefix, model: "Modelo de prueba", variant: "150", yearFrom: "2020", yearTo: "2024" }] };
    await saveCatalogDetails(prisma, details);
    const catalog = (await publicCatalog(prisma)).find((p) => p.id === productId)!;
    expect(catalog.images).toEqual(details.images);
    expect(catalog.fitments[0]).toMatchObject({ yearFrom: 2020, yearTo: 2024, vehicleModel: { brand: prefix.toUpperCase(), model: "MODELO DE PRUEBA" } });
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 1 });
    await expect(saveCatalogDetails(prisma, { ...details, images: [] })).rejects.toThrow(/La ficha cambió/u);
    expect(await prisma.shopProductImage.count({ where: { productId } })).toBe(1);
    expect(await prisma.shopOrderItem.findFirst({ where: { orderId: order.id } })).toMatchObject({ name: "Filtro", unitPriceCents: 125050 });
  });
  it("accepts only one concurrent order for the last unit", async () => {
    await prisma.shopProduct.update({ where: { id: productId }, data: { stock: 1 } });
    const results = await Promise.allSettled([reserveShopOrder(prisma, input()), reserveShopOrder(prisma, input())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 1, reservedStock: 1 });
  });
  it("rejects manipulated prices, unpublished products and changed shipping fees", async () => {
    await expect(reserveShopOrder(prisma, input({ items: [{ productId, quantity: 1, unitPriceCents: 1 }] }))).rejects.toThrow("Cambió el precio");
    await expect(reserveShopOrder(prisma, input({ deliveryKind: "SHIPPING", address: "Calle 123", city: "Salta", province: "Salta", postalCode: "4400", shippingFeeCents: 0 }))).rejects.toThrow("costo de envío");
    await prisma.shopProduct.update({ where: { id: productId }, data: { isPublished: false } });
    await expect(reserveShopOrder(prisma, input())).rejects.toThrow("ya no está disponible");
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ reservedStock: 0 });
  });
  it("prices shipping from the configuration, validates coverage and saves address", async () => {
    const data = input({ deliveryKind: "SHIPPING", address: "Calle 123", city: "Salta", province: "Salta", postalCode: "4400", shippingFeeCents: 50000, buyerKind: "INDIVIDUAL" });
    const order = await reserveShopOrder(prisma, data);
    expect(order).toMatchObject({ totalCents: 175050, shippingFeeCents: 50000, postalCode: "4400", buyerKind: "INDIVIDUAL" });
    await expect(reserveShopOrder(prisma, { ...data, requestKey: randomUUID(), postalCode: "9999" })).rejects.toThrow("no enviamos");
    await expect(reserveShopOrder(prisma, { ...data, requestKey: randomUUID(), city: "San Lorenzo" })).rejects.toThrow("no enviamos fuera de Salta capital");
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ reservedStock: 1 });
  });
  it("requires the private access token and exposes no personal or internal data", async () => {
    const data = input();
    const order = await reserveShopOrder(prisma, data);
    expect(await publicOrder(prisma, order.id)).toBeNull();
    expect(await publicOrder(prisma, randomBytes(32).toString("hex"))).toBeNull();
    const publicView = await publicOrder(prisma, data.accessToken);
    expect(publicView?.code).toBe(order.code);
    expect(publicView).not.toHaveProperty("email");
    expect(publicView).not.toHaveProperty("accessTokenHash");
    const catalog = await publicCatalog(prisma);
    expect(catalog.find((p) => p.id === productId)).not.toHaveProperty("location");
  });
  it("verifies the payment amount, currency and environment", async () => {
    const order = await reserveShopOrder(prisma, input());
    for (const changes of [{ amount: 1 }, { currency: "USD" }, { liveMode: true }]) {
      await expect(applyShopPayment(prisma, payment(order.id, changes), false)).rejects.toThrow("no coincide");
    }
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "AWAITING_PAYMENT" });
  });
  it("records duplicate approvals once and blocks delivery before payment", async () => {
    const order = await reserveShopOrder(prisma, input());
    await expect(fulfillShopOrder(prisma, order.id, "COMPLETED", actorId)).rejects.toThrow("estado actual");
    const paid = payment(order.id);
    await Promise.all([applyShopPayment(prisma, paid, false), applyShopPayment(prisma, paid, false)]);
    await fulfillShopOrder(prisma, order.id, "READY", actorId);
    await Promise.all([fulfillShopOrder(prisma, order.id, "COMPLETED", actorId), fulfillShopOrder(prisma, order.id, "COMPLETED", actorId)]);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 1, reservedStock: 0 });
    expect(await prisma.inventoryMovement.count({ where: { productId, kind: "SALE" } })).toBe(1);
    expect(await prisma.shopOrderEvent.count({ where: { orderId: order.id, status: "PAID" } })).toBe(1);
  });
  it("deducts stock at dispatch and never a second time at delivery", async () => {
    const order = await reserveShopOrder(prisma, input({ deliveryKind: "SHIPPING", address: "Calle 123", city: "Salta", province: "Salta", postalCode: "4400", shippingFeeCents: 50000 }));
    await applyShopPayment(prisma, payment(order.id, { amount: 1750.5 }), false);
    await expect(fulfillShopOrder(prisma, order.id, "SHIPPED", actorId)).rejects.toThrow("seguimiento");
    await fulfillShopOrder(prisma, order.id, "SHIPPED", actorId, "Correo · COD123");
    await fulfillShopOrder(prisma, order.id, "COMPLETED", actorId);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 1, reservedStock: 0 });
    expect(await prisma.inventoryMovement.count({ where: { productId, kind: "SALE" } })).toBe(1);
  });
  it("releases an expired reservation once and flags late payments without re-reserving", async () => {
    const order = await reserveShopOrder(prisma, input(), new Date(Date.now() - 60 * 60_000));
    await Promise.all([closeUnpaidOrder(prisma, order.id, "EXPIRED"), closeUnpaidOrder(prisma, order.id, "EXPIRED")]);
    await applyShopPayment(prisma, payment(order.id), false);
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PAYMENT_REVIEW", reservationHeld: false });
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 0 });
    await expect(fulfillShopOrder(prisma, order.id, "COMPLETED", actorId)).rejects.toThrow("Revisá el pago");
  });
  it("does not release expired stock when the payment lookup fails and preserves credited payments", async () => {
    const order = await reserveShopOrder(prisma, input(), new Date(Date.now() - 60 * 60_000));
    const provider = port();
    vi.mocked(provider.searchPayments).mockRejectedValueOnce(new Error("offline"));
    await expect(reconcileShopOrder(prisma, provider, order.id, false)).rejects.toThrow("offline");
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ reservedStock: 1 });
    await reconcileShopOrder(prisma, port([payment(order.id)]), order.id, false);
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PAID" });
    await expect(closeUnpaidOrder(prisma, order.id, "CANCELLED", actorId)).rejects.toThrow("sin pago");
  });
  it("reuses the hosted checkout and retains the reservation after a provider failure", async () => {
    const data = input();
    const order = await reserveShopOrder(prisma, data);
    const provider = port();
    vi.mocked(provider.createPreference).mockRejectedValueOnce(new Error("offline"));
    await expect(startShopPayment(prisma, provider, data.accessToken)).rejects.toThrow("offline");
    const checkout = await startShopPayment(prisma, provider, data.accessToken);
    expect(await startShopPayment(prisma, provider, data.accessToken)).toBe(checkout);
    expect(vi.mocked(provider.createPreference)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(provider.createPreference)).toHaveBeenLastCalledWith(expect.objectContaining({ externalReference: `shop:${order.id}`, amountCents: 125050 }));
  });
  it("flags refunds, chargebacks and additional approvals without restoring or consuming stock", async () => {
    const order = await reserveShopOrder(prisma, input());
    const paid = payment(order.id);
    await applyShopPayment(prisma, paid, false);
    await applyShopPayment(prisma, { ...paid, status: "refunded" }, false);
    await applyShopPayment(prisma, paid, false);
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PAYMENT_REVIEW" });
    expect(await prisma.shopPayment.findUnique({ where: { id: paid.id } })).toMatchObject({ status: "refunded" });
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 1 });
    await closeReviewedShopOrder(prisma, order.id, actorId);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 0 });
  });
  it("requires a verified refund to close a late or duplicate payment review", async () => {
    const order = await reserveShopOrder(prisma, input());
    await applyShopPayment(prisma, payment(order.id), false);
    await applyShopPayment(prisma, payment(order.id), false);
    await expect(closeReviewedShopOrder(prisma, order.id, actorId)).rejects.toThrow("pago acreditado");
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PAYMENT_REVIEW", reservationHeld: true });
  });
  it("creates only one preference for concurrent checkout starts", async () => {
    const data = input();
    await reserveShopOrder(prisma, data);
    const provider = port();
    const results = await Promise.allSettled([startShopPayment(prisma, provider, data.accessToken), startShopPayment(prisma, provider, data.accessToken)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(provider.createPreference).toHaveBeenCalledTimes(1);
    expect(await startShopPayment(prisma, provider, data.accessToken)).toContain("mercadopago.com.ar");
    expect(provider.createPreference).toHaveBeenCalledTimes(1);
  });
  it("blocks dispatch when an approved payment has a partial refund", async () => {
    const order = await reserveShopOrder(prisma, input());
    const paid = payment(order.id, { refundedAmount: 100 });
    await applyShopPayment(prisma, paid, false);
    expect(await prisma.shopOrder.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PAYMENT_REVIEW" });
    await expect(fulfillShopOrder(prisma, order.id, "COMPLETED", actorId)).rejects.toThrow("Revisá el pago");
    await expect(closeReviewedShopOrder(prisma, order.id, actorId)).rejects.toThrow("pago acreditado");
    await applyShopPayment(prisma, { ...paid, status: "refunded", refundedAmount: 1250.5 }, false);
    await closeReviewedShopOrder(prisma, order.id, actorId);
    expect(await prisma.shopProduct.findUnique({ where: { id: productId } })).toMatchObject({ stock: 2, reservedStock: 0 });
  });
});
