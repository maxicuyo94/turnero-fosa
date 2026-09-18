// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/src/lib/env";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";
import { findSimilarInventoryCodes, linkInventoryBarcode, resolveInventoryCode } from "@/src/modules/shop/inventory-code-service";
import { createInventoryProduct } from "@/src/modules/shop/inventory-service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
const target = resolveTestDataTarget({
  profile: "development",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" },
});
const codeSuite = target.allowed ? describe : describe.skip;
const run = randomUUID().slice(0, 8).toUpperCase();
const fixturePrefix = `IT-E2-${run}-`;
// Codigos numericos unicos por corrida, con la forma de un UPC-A de 12 digitos.
const upc = `9${Date.now().toString().slice(-11)}`;

codeSuite("códigos de inventario con PostgreSQL", () => {
  beforeEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("resuelve por código de barras y por SKU sin distinguir mayúsculas", async () => {
    const product = await createProduct({ sku: `${fixturePrefix}FILTRO`, barcode: `${fixturePrefix}779` });

    expect(await resolveInventoryCode(prisma, ` ${fixturePrefix}779 `)).toMatchObject({ status: "found", product: { id: product.id } });
    expect(await resolveInventoryCode(prisma, `${fixturePrefix}filtro`.toLowerCase())).toMatchObject({ status: "found", product: { id: product.id } });
  });

  it("encuentra el mismo producto leído como UPC-A o como EAN-13", async () => {
    const product = await createProduct({ sku: `${fixturePrefix}UPC`, barcode: upc });

    expect(await resolveInventoryCode(prisma, `0${upc}`)).toMatchObject({ status: "found", product: { id: product.id } });
  });

  it("encuentra códigos guardados con espacios, guiones o caracteres invisibles", async () => {
    const digits = `8${Date.now().toString().slice(-12)}`;
    const spaced = await createProduct({ sku: `${fixturePrefix}ESP`, barcode: `${digits.slice(0, 1)} ${digits.slice(1, 7)} ${digits.slice(7)}` });
    const dashed = await createProduct({ sku: `${fixturePrefix}GUION`, barcode: `${fixturePrefix}AB-12​` });

    expect(await resolveInventoryCode(prisma, digits)).toMatchObject({ status: "found", product: { id: spaced.id } });
    expect(await resolveInventoryCode(prisma, `${fixturePrefix}ab12`)).toMatchObject({ status: "found", product: { id: dashed.id } });
  });

  it("sugiere fichas con un código casi igual sin abrirlas", async () => {
    const digits = `6${Date.now().toString().slice(-12)}`;
    const missingCheckDigit = await createProduct({ sku: `${fixturePrefix}CASI`, barcode: digits.slice(0, 12) });

    expect(await resolveInventoryCode(prisma, digits)).toMatchObject({ status: "unknown" });
    expect((await findSimilarInventoryCodes(prisma, digits)).map((product) => product.id)).toContain(missingCheckDigit.id);
    expect(await findSimilarInventoryCodes(prisma, "12345")).toEqual([]);
  });

  it("guarda sin espacios los códigos cargados desde la ficha", async () => {
    const product = await createInventoryProduct(prisma, {
      sku: `${fixturePrefix}ALTA`, barcode: " 7 791234 567890 ", name: "Alta con espacios", category: "Pruebas E2",
      priceArs: "10", initialStock: "0", minimumStock: "0", isActive: true, requestKey: randomUUID(),
    }, await fixtureActorId());

    expect(product.barcode).toBe("7791234567890");
  });

  it("informa códigos desconocidos y no adivina cuando hay más de una coincidencia", async () => {
    await createProduct({ sku: `${fixturePrefix}A`, barcode: `${fixturePrefix}B` });
    await createProduct({ sku: `${fixturePrefix}B`, barcode: null });

    expect(await resolveInventoryCode(prisma, `${fixturePrefix}NADA`)).toEqual({ status: "unknown", code: `${fixturePrefix}NADA` });
    const ambiguous = await resolveInventoryCode(prisma, `${fixturePrefix}B`);
    expect(ambiguous?.status).toBe("ambiguous");
    expect(ambiguous?.status === "ambiguous" ? ambiguous.products : []).toHaveLength(2);
    expect(await resolveInventoryCode(prisma, "   ")).toBeNull();
  });

  it("vincula un código a un repuesto sin código y no toca el stock", async () => {
    const product = await createProduct({ sku: `${fixturePrefix}SIN`, barcode: null, stock: 4 });

    const linked = await linkInventoryBarcode(prisma, { productId: product.id, barcode: ` ${fixturePrefix}NUEVO `, version: "0" });

    expect(linked).toMatchObject({ barcode: `${fixturePrefix}NUEVO`, stock: 4, version: 1 });
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(0);
  });

  it("no reemplaza un código existente ni reutiliza uno tomado", async () => {
    const withCode = await createProduct({ sku: `${fixturePrefix}CON`, barcode: `${fixturePrefix}VIEJO` });
    const withoutCode = await createProduct({ sku: `${fixturePrefix}LIBRE`, barcode: null });

    await expect(linkInventoryBarcode(prisma, { productId: withCode.id, barcode: `${fixturePrefix}OTRO`, version: "0" }))
      .rejects.toThrow(`ya tiene el código ${fixturePrefix}VIEJO`);
    await expect(linkInventoryBarcode(prisma, { productId: withoutCode.id, barcode: `${fixturePrefix}VIEJO`, version: "0" }))
      .rejects.toThrow("ya identifica");
    await expect(linkInventoryBarcode(prisma, { productId: withoutCode.id, barcode: `${fixturePrefix}CON`, version: "0" }))
      .rejects.toThrow("ya identifica");
    expect(await prisma.shopProduct.findUniqueOrThrow({ where: { id: withoutCode.id } })).toMatchObject({ barcode: null, version: 0 });
  });

  it("rechaza una versión vieja de la ficha", async () => {
    const product = await createProduct({ sku: `${fixturePrefix}VER`, barcode: null });
    await prisma.shopProduct.update({ where: { id: product.id }, data: { version: { increment: 1 } } });

    await expect(linkInventoryBarcode(prisma, { productId: product.id, barcode: `${fixturePrefix}TARDE`, version: "0" }))
      .rejects.toThrow("actualizado por otra persona");
  });

  it("dos vinculaciones simultáneas del mismo código dejan una sola", async () => {
    const first = await createProduct({ sku: `${fixturePrefix}P1`, barcode: null });
    const second = await createProduct({ sku: `${fixturePrefix}P2`, barcode: null });
    const code = `${fixturePrefix}CARRERA`;

    const results = await Promise.allSettled([
      linkInventoryBarcode(prisma, { productId: first.id, barcode: code, version: "0" }),
      linkInventoryBarcode(prisma, { productId: second.id, barcode: code, version: "0" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.shopProduct.count({ where: { barcode: code } })).toBe(1);
  });
});

async function createProduct({ sku, barcode, stock = 0 }: { sku: string; barcode: string | null; stock?: number }) {
  return prisma.shopProduct.create({
    data: { sku, barcode, name: `Repuesto ${sku}`, category: "Pruebas E2", priceCents: 1000, stock },
  });
}

let actorId: string | undefined;

async function fixtureActorId(): Promise<string> {
  actorId ??= (await prisma.user.create({
    data: { email: `code-${run.toLowerCase()}@test.invalid`, username: `code-${run.toLowerCase()}`, name: "Códigos E2 test", passwordHash: "x" },
    select: { id: true },
  })).id;
  return actorId;
}

async function cleanupFixtures() {
  const products = await prisma.shopProduct.findMany({ where: { OR: [{ sku: { startsWith: fixturePrefix } }, { barcode: upc }] }, select: { id: true } });
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: products.map(({ id }) => id) } } });
  await prisma.shopProduct.deleteMany({ where: { id: { in: products.map(({ id }) => id) } } });
}
