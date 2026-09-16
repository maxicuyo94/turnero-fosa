// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { createPasswordHash } from "@/src/lib/password";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";
import {
  createInventoryProduct,
  recordInventoryMovement,
  updateInventoryProduct,
} from "@/src/modules/shop/inventory-service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const inventorySuite = target.allowed ? describe : describe.skip;
const fixturePrefix = `IT-E1-${randomUUID().slice(0, 8).toUpperCase()}-`;
let actorId: string;

inventorySuite("inventario Prisma E1", () => {
  beforeAll(async () => {
    const fixtureId = randomUUID().slice(0, 8);
    const actor = await prisma.user.create({
      data: {
        email: `inventory-e1-${fixtureId}@test.invalid`,
        username: `inventory-e1-${fixtureId}`,
        name: "Inventario E1 test",
        passwordHash: await createPasswordHash(randomUUID()),
      },
      select: { id: true },
    });
    actorId = actor.id;
  });

  beforeEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("crea el repuesto normalizado y registra el stock inicial en el historial", async () => {
    const product = await createProduct({ initialStock: "3", priceArs: "1234,50", barcode: " 000123 ", description: " " });
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { requestKey: product.requestKey } });

    expect(product).toMatchObject({
      sku: product.sku,
      barcode: "000123",
      description: null,
      priceCents: 123450,
      stock: 3,
      reservedStock: 0,
      minimumStock: 1,
      version: 0,
    });
    expect(movement).toMatchObject({
      productId: product.id,
      kind: "INITIAL",
      quantityDelta: 3,
      stockBefore: 0,
      stockAfter: 3,
      reason: "Stock inicial",
      actorId,
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("preserva ceros del código y permite editar precio y ficha con la versión vigente", async () => {
    const product = await createProduct({ initialStock: 2, priceArs: "99.9", barcode: "00000042" });
    const updated = await updateInventoryProduct(prisma, {
      id: product.id,
      version: product.version,
      sku: product.sku,
      barcode: product.barcode,
      name: "Pastillas premium",
      description: "Juego delantero",
      category: product.category,
      brand: product.brand,
      compatibility: product.compatibility,
      location: "B-4",
      priceArs: "100,00",
      minimumStock: 2,
      isActive: true,
    });

    expect(updated).toMatchObject({ name: "Pastillas premium", barcode: "00000042", priceCents: 10000, location: "B-4", version: 1, stock: 2 });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
  });

  it("registra entrada, consumo y ajuste con cantidades anteriores y posteriores auditadas", async () => {
    const product = await createProduct({ initialStock: 2 });
    const receipt = await recordInventoryMovement(prisma, {
      productId: product.id, kind: "RECEIPT", quantity: "3", reason: "Compra a proveedor", reference: "OC-E1-1",
      version: product.version, requestKey: randomUUID(),
    }, actorId);
    const repair = await recordInventoryMovement(prisma, {
      productId: product.id, kind: "REPAIR", quantity: 1, reason: "Consumo OT-E1-1", reference: "OT-E1-1",
      version: receipt.version, requestKey: randomUUID(),
    }, actorId);
    const adjusted = await recordInventoryMovement(prisma, {
      productId: product.id, kind: "ADJUSTMENT", quantity: 5, reason: "Conteo físico", reference: "CONTEO-E1-1",
      version: repair.version, requestKey: randomUUID(),
    }, actorId);
    const history = await prisma.inventoryMovement.findMany({ where: { productId: product.id }, orderBy: { createdAt: "asc" } });

    expect(adjusted).toMatchObject({ stock: 5, version: 3 });
    expect(history.map(({ kind, quantityDelta, stockBefore, stockAfter, reason, reference }) => ({ kind, quantityDelta, stockBefore, stockAfter, reason, reference }))).toEqual([
      { kind: "INITIAL", quantityDelta: 2, stockBefore: 0, stockAfter: 2, reason: "Stock inicial", reference: null },
      { kind: "RECEIPT", quantityDelta: 3, stockBefore: 2, stockAfter: 5, reason: "Compra a proveedor", reference: "OC-E1-1" },
      { kind: "REPAIR", quantityDelta: -1, stockBefore: 5, stockAfter: 4, reason: "Consumo OT-E1-1", reference: "OT-E1-1" },
      { kind: "ADJUSTMENT", quantityDelta: 1, stockBefore: 4, stockAfter: 5, reason: "Conteo físico", reference: "CONTEO-E1-1" },
    ]);
  });

  it("respeta el stock reservado y no deja movimientos parciales", async () => {
    const product = await createProduct({ initialStock: 5 });
    await prisma.shopProduct.update({ where: { id: product.id }, data: { reservedStock: 4 } });

    await expect(recordInventoryMovement(prisma, {
      productId: product.id, kind: "REPAIR", quantity: 2, reason: "Consumo reservado", version: product.version, requestKey: randomUUID(),
    }, actorId)).rejects.toThrow("No hay stock disponible suficiente para registrar el consumo.");
    await expect(recordInventoryMovement(prisma, {
      productId: product.id, kind: "ADJUSTMENT", quantity: 3, reason: "Conteo menor", version: product.version, requestKey: randomUUID(),
    }, actorId)).rejects.toThrow("El ajuste no puede dejar menos unidades que las ya reservadas.");

    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 5, reservedStock: 4, version: 0 });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
  });

  it("hace rollback de una operación rechazada sin modificar stock ni auditoría", async () => {
    const product = await createProduct({ initialStock: 1 });
    const requestKey = randomUUID();

    await expect(recordInventoryMovement(prisma, {
      productId: product.id, kind: "REPAIR", quantity: 2, reason: "Consumo imposible", version: product.version, requestKey,
    }, actorId)).rejects.toThrow("No hay stock disponible suficiente para registrar el consumo.");

    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 1, version: 0 });
    expect(await prisma.inventoryMovement.findUnique({ where: { requestKey } })).toBeNull();
  });

  it("hace rollback si falla la auditoría después de actualizar el stock", async () => {
    const product = await createProduct({ initialStock: 2 });
    const requestKey = randomUUID();

    await expect(recordInventoryMovement(prisma, {
      productId: product.id,
      kind: "RECEIPT",
      quantity: 3,
      reason: "Actor inexistente",
      version: product.version,
      requestKey,
    }, `missing-inventory-actor-${randomUUID()}`)).rejects.toMatchObject({ code: "P2003" });

    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 2, version: 0 });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
    expect(await prisma.inventoryMovement.findUnique({ where: { requestKey } })).toBeNull();
  });

  it("no duplica una creación ni un movimiento al reintentar la misma clave y contenido", async () => {
    const input = createInput({ initialStock: 4 });
    const first = await createInventoryProduct(prisma, input, actorId);
    const second = await createInventoryProduct(prisma, input, actorId);
    expect(second.id).toBe(first.id);
    expect(await prisma.shopProduct.count({ where: { sku: first.sku } })).toBe(1);
    expect(await prisma.inventoryMovement.count({ where: { productId: first.id } })).toBe(1);

    const movementInput = { productId: first.id, kind: "RECEIPT", quantity: 2, reason: "Reintento", reference: "R-1", version: first.version, requestKey: randomUUID() } as const;
    const moved = await recordInventoryMovement(prisma, movementInput, actorId);
    const retried = await recordInventoryMovement(prisma, movementInput, actorId);
    expect(retried.id).toBe(moved.id);
    expect(await prisma.inventoryMovement.count({ where: { productId: first.id } })).toBe(2);
    expect(retried.stock).toBe(6);
  });

  it("rechaza reutilizar una clave con contenido distinto", async () => {
    const input = createInput({ initialStock: 1 });
    await createInventoryProduct(prisma, input, actorId);

    await expect(createInventoryProduct(prisma, { ...input, name: "Otro nombre" }, actorId)).rejects.toThrow("La clave de esta operación ya fue usada con datos diferentes.");

    const product = await prisma.shopProduct.findUniqueOrThrow({ where: { sku: input.sku.trim().toUpperCase() } });
    const requestKey = randomUUID();
    const movement = { productId: product.id, kind: "RECEIPT", quantity: 1, reason: "Entrada", reference: null, version: product.version, requestKey } as const;
    await recordInventoryMovement(prisma, movement, actorId);
    await expect(recordInventoryMovement(prisma, { ...movement, quantity: 2 }, actorId)).rejects.toThrow("La clave de esta operación ya fue usada con datos diferentes.");
    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 2, version: 1 });
  });

  it("serializa dos creaciones concurrentes con la misma clave sin duplicar datos", async () => {
    const input = createInput({ initialStock: 4 });
    const results = await Promise.all([
      createInventoryProduct(prisma, input, actorId),
      createInventoryProduct(prisma, input, actorId),
    ]);

    expect(results[1].id).toBe(results[0].id);
    expect(await prisma.shopProduct.count({ where: { sku: results[0].sku } })).toBe(1);
    expect(await prisma.inventoryMovement.count({ where: { productId: results[0].id } })).toBe(1);
  });

  it("rechaza una versión vieja sin alterar ficha, stock o historial", async () => {
    const product = await createProduct({ initialStock: 2 });
    const updated = await updateInventoryProduct(prisma, {
      id: product.id, version: product.version, sku: product.sku, barcode: product.barcode, name: "Ficha vigente",
      description: product.description, category: product.category, brand: product.brand, compatibility: product.compatibility,
      location: product.location, priceArs: product.priceCents / 100, minimumStock: product.minimumStock, isActive: product.isActive,
    });

    await expect(recordInventoryMovement(prisma, {
      productId: product.id, kind: "RECEIPT", quantity: 1, reason: "Versión vieja", version: product.version, requestKey: randomUUID(),
    }, actorId)).rejects.toThrow("El producto fue actualizado por otra persona. Recargá la página e intentá de nuevo.");
    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ name: "Ficha vigente", stock: 2, version: updated.version });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
  });

  it("serializa dos consumos concurrentes de la última unidad", async () => {
    const product = await createProduct({ initialStock: 1 });
    const operation = (requestKey: string) => recordInventoryMovement(prisma, {
      productId: product.id, kind: "REPAIR", quantity: 1, reason: "Dos órdenes simultáneas", reference: null,
      version: product.version, requestKey,
    }, actorId);

    const results = await Promise.allSettled([operation(randomUUID()), operation(randomUUID())]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 0, version: 1 });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, kind: "REPAIR" } })).toBe(1);
  });
});

type CreateOverrides = Partial<{ initialStock: string | number; priceArs: string | number; barcode: string | null; description: string | null }>;

function createInput(overrides: CreateOverrides = {}) {
  const id = randomUUID();
  return {
    sku: `${fixturePrefix}${id.slice(0, 8)}`,
    barcode: `${id.replaceAll("-", "").slice(0, 12)}`,
    name: "Repuesto E1",
    description: "Descripción de prueba",
    category: "Filtros",
    brand: "Honda",
    compatibility: "CG 150",
    location: "A-1",
    priceArs: 2500,
    initialStock: 0,
    minimumStock: 1,
    isActive: true,
    requestKey: randomUUID(),
    ...overrides,
  };
}

async function createProduct(overrides: CreateOverrides = {}) {
  const productInput = createInput(overrides);
  const product = await createInventoryProduct(prisma, productInput, actorId);
  return Object.assign(product, { requestKey: productInput.requestKey });
}

async function cleanupFixtures() {
  const products = await prisma.shopProduct.findMany({ where: { sku: { startsWith: fixturePrefix } }, select: { id: true } });
  const productIds = products.map(({ id }) => id);
  if (productIds.length === 0) return;
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.shopProduct.deleteMany({ where: { id: { in: productIds } } });
}
