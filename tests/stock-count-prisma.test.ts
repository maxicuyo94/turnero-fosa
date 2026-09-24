// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";
import { createInventoryProduct, recordInventoryMovement } from "@/src/modules/shop/inventory-service";
import {
  StockCountConflictError,
  applyStockCount,
  cancelStockCount,
  openStockCount,
  recordCountedQuantity,
  recountStockCountLine,
} from "@/src/modules/shop/stock-count-service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const countSuite = target.allowed ? describe : describe.skip;
const fixturePrefix = `IT-E2-${randomUUID().slice(0, 8).toUpperCase()}-`;
// Cada prueba usa su propia ubicacion para que el conteo solo abarque sus repuestos.
let location: string;
let actorId: string;

countSuite("conteos de stock en PostgreSQL", () => {
  beforeAll(async () => {
    const fixtureId = randomUUID().slice(0, 8);
    actorId = (await prisma.user.create({
      data: { email: `stock-count-${fixtureId}@test.invalid`, username: `stock-count-${fixtureId}`, name: "Conteo test", passwordHash: await createPasswordHash(randomUUID()) },
      select: { id: true },
    })).id;
  });

  beforeEach(async () => {
    await cleanupFixtures();
    location = `${fixturePrefix}${randomUUID().slice(0, 6)}`;
  });

  afterAll(async () => {
    await cleanupFixtures();
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("abrir y contar no modifica el stock; aplicar ajusta solo las diferencias contadas", async () => {
    const counted = await product("Filtro", 5);
    const same = await product("Bujía", 3);
    const skipped = await product("Cadena", 7);
    const zero = await product("Pastilla", 2);
    const { id: countId } = await openStockCount(prisma, { location }, actorId);

    await recordCountedQuantity(prisma, { countId, productId: counted.id, quantity: "4" }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: same.id, quantity: "3" }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: zero.id, quantity: "0" }, actorId);
    expect(await stocks()).toEqual({ Filtro: 5, "Bujía": 3, Cadena: 7, Pastilla: 2 });

    const result = await applyStockCount(prisma, { countId, reason: "Conteo mensual" }, actorId);

    expect(result.adjusted).toBe(2);
    expect(await stocks()).toEqual({ Filtro: 4, "Bujía": 3, Cadena: 7, Pastilla: 0 });
    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { productId: counted.id, kind: "ADJUSTMENT" } });
    expect(movement).toMatchObject({ quantityDelta: -1, stockBefore: 5, stockAfter: 4, actorId, reference: `Conteo ${countId}` });
    expect(movement.reason).toContain("Conteo mensual");
    expect(await prisma.inventoryMovement.count({ where: { productId: skipped.id, kind: "ADJUSTMENT" } })).toBe(0);
    expect(await prisma.stockCount.findUniqueOrThrow({ where: { id: countId } })).toMatchObject({ status: "APPLIED", closedById: actorId });
  });

  it("una lectura repetida reemplaza la cantidad en lugar de sumarla, y vaciarla vuelve a sin contar", async () => {
    const item = await product("Filtro", 5);
    const { id: countId } = await openStockCount(prisma, { location }, actorId);

    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "2" }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "2" }, actorId);
    expect((await line(countId, item.id)).countedQuantity).toBe(2);

    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "" }, actorId);
    expect((await line(countId, item.id)).countedQuantity).toBeNull();
    await expect(applyStockCount(prisma, { countId, reason: "x" }, actorId)).rejects.toThrow("Todavía no contaste");
  });

  it("rechaza aplicar si el repuesto se movió durante el conteo, aunque el stock vuelva al mismo número", async () => {
    const item = await product("Filtro", 5);
    const { id: countId } = await openStockCount(prisma, { location }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "4" }, actorId);
    await move(item.id, "RECEIPT", 1);
    await move(item.id, "REPAIR", 1);

    const error = await applyStockCount(prisma, { countId, reason: "Mensual" }, actorId).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StockCountConflictError);
    expect((error as StockCountConflictError).issues).toEqual([{ productId: item.id, name: `${fixturePrefix}Filtro`, kind: "moved" }]);
    expect(await stocks()).toEqual({ Filtro: 5 });

    await recountStockCountLine(prisma, { countId, productId: item.id });
    expect((await line(countId, item.id)).countedQuantity).toBeNull();
    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "4" }, actorId);
    await applyStockCount(prisma, { countId, reason: "Mensual" }, actorId);
    expect(await stocks()).toEqual({ Filtro: 4 });
  });

  it("no deja un físico contado menor que las unidades reservadas", async () => {
    const item = await product("Filtro", 5);
    await prisma.shopProduct.update({ where: { id: item.id }, data: { reservedStock: 3 } });
    const { id: countId } = await openStockCount(prisma, { location }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "2" }, actorId);

    const error = await applyStockCount(prisma, { countId, reason: "Mensual" }, actorId).catch((caught: unknown) => caught);

    expect((error as StockCountConflictError).issues[0]?.kind).toBe("reserved");
    expect(await stocks()).toEqual({ Filtro: 5 });
  });

  it("dos confirmaciones simultáneas registran un solo ajuste", async () => {
    const item = await product("Filtro", 5);
    const { id: countId } = await openStockCount(prisma, { location }, actorId);
    await recordCountedQuantity(prisma, { countId, productId: item.id, quantity: "8" }, actorId);

    const results = await Promise.allSettled([
      applyStockCount(prisma, { countId, reason: "Mensual" }, actorId),
      applyStockCount(prisma, { countId, reason: "Mensual" }, actorId),
    ]);

    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(await prisma.inventoryMovement.count({ where: { productId: item.id, kind: "ADJUSTMENT" } })).toBe(1);
    expect(await stocks()).toEqual({ Filtro: 8 });
  });

  it("suma al conteo un repuesto encontrado en otra ubicación y no acepta cambios después de cerrar", async () => {
    await product("Filtro", 5);
    const elsewhere = await product("Espejo", 1, `${location}-otro`);
    const { id: countId } = await openStockCount(prisma, { location }, actorId);

    await recordCountedQuantity(prisma, { countId, productId: elsewhere.id, quantity: "1" }, actorId);
    expect(await prisma.stockCountLine.count({ where: { countId } })).toBe(2);

    await cancelStockCount(prisma, { countId, reason: "Se reinicia" }, actorId);
    await expect(recordCountedQuantity(prisma, { countId, productId: elsewhere.id, quantity: "2" }, actorId)).rejects.toThrow("cerrado");
    await expect(applyStockCount(prisma, { countId, reason: "x" }, actorId)).rejects.toThrow("cancelado");
  });
});

async function product(name: string, stock: number, at = location) {
  const requestKey = randomUUID();
  return createInventoryProduct(prisma, { sku: `${fixturePrefix}${randomUUID().slice(0, 8)}`, name: `${fixturePrefix}${name}`, category: "Test", location: at, priceArs: "100", initialStock: String(stock), minimumStock: "0", isActive: true, requestKey }, actorId);
}

async function move(productId: string, kind: "RECEIPT" | "REPAIR", quantity: number) {
  const { version } = await prisma.shopProduct.findUniqueOrThrow({ where: { id: productId } });
  await recordInventoryMovement(prisma, { productId, kind, quantity: String(quantity), reason: "Durante el conteo", version: String(version), requestKey: randomUUID() }, actorId);
}

async function stocks() {
  const rows = await prisma.shopProduct.findMany({ where: { location }, select: { name: true, stock: true } });
  return Object.fromEntries(rows.map((row) => [row.name.slice(fixturePrefix.length), row.stock]));
}

function line(countId: string, productId: string) {
  return prisma.stockCountLine.findUniqueOrThrow({ where: { countId_productId: { countId, productId } } });
}

async function cleanupFixtures() {
  const products = await prisma.shopProduct.findMany({ where: { sku: { startsWith: fixturePrefix } }, select: { id: true } });
  const ids = products.map((row) => row.id);
  await prisma.stockCount.deleteMany({ where: { lines: { some: { productId: { in: ids } } } } });
  await prisma.stockCount.deleteMany({ where: { openedById: actorId } });
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
  await prisma.shopProduct.deleteMany({ where: { id: { in: ids } } });
}
