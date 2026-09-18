import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type ShopProduct } from "@prisma/client";
import {
  createInventoryProductSchema,
  recordInventoryMovementSchema,
  updateInventoryProductSchema,
  type CreateInventoryProductInput,
  type RecordInventoryMovementInput,
} from "@/src/modules/shop/inventory-schemas";

type InventoryClient = Pick<PrismaClient, "shopProduct" | "inventoryMovement">;

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export async function createInventoryProduct(prisma: PrismaClient, input: unknown, actorId: string): Promise<ShopProduct> {
  const parsed = createInventoryProductSchema.parse(input);
  const fingerprint = fingerprintFor("create", actorId, parsed);

  try {
    return await withInventoryTransaction(prisma, async (tx) => {
      const existing = await idempotentProduct(tx, parsed.requestKey, fingerprint);
      if (existing) return existing;

      const product = await tx.shopProduct.create({
        data: {
          sku: parsed.sku,
          barcode: parsed.barcode,
          name: parsed.name,
          description: parsed.description,
          category: parsed.category,
          brand: parsed.brand,
          compatibility: parsed.compatibility,
          location: parsed.location,
          priceCents: parsed.priceArs,
          stock: parsed.initialStock,
          minimumStock: parsed.minimumStock,
          isActive: parsed.isActive,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          kind: "INITIAL",
          quantityDelta: parsed.initialStock,
          stockBefore: 0,
          stockAfter: parsed.initialStock,
          reason: "Stock inicial",
          actorId,
          requestKey: parsed.requestKey,
          requestFingerprint: fingerprint,
        },
      });
      return product;
    });
  } catch (error) {
    return resolveIdempotencyConflict(prisma, parsed.requestKey, fingerprint, error, "Ya existe un producto con ese SKU o código de barras.");
  }
}

export async function importInventoryProducts(
  prisma: PrismaClient,
  inputs: unknown[],
  actorId: string,
): Promise<{ count: number; initialUnits: number }> {
  if (!inputs.length || inputs.length > 1_000) throw new InventoryError("El archivo debe contener entre 1 y 1.000 productos.");
  const parsed = inputs.map((input) => createInventoryProductSchema.parse(input));
  const duplicateSku = duplicateValue(parsed.map((product) => product.sku));
  if (duplicateSku) throw new InventoryError(`El SKU ${duplicateSku} está repetido dentro del Excel.`);
  const duplicateBarcode = duplicateValue(parsed.flatMap((product) => product.barcode ? [product.barcode] : []));
  if (duplicateBarcode) throw new InventoryError(`El código de barras ${duplicateBarcode} está repetido dentro del Excel.`);

  try {
    return await withInventoryTransaction(prisma, async (tx) => {
      const existing = await tx.shopProduct.findMany({
        where: {
          OR: [
            { sku: { in: parsed.map((product) => product.sku) } },
            { barcode: { in: parsed.flatMap((product) => product.barcode ? [product.barcode] : []) } },
          ],
        },
        select: { sku: true, barcode: true },
      });
      if (existing.length) {
        const conflict = existing[0];
        throw new InventoryError(`Ya existe un producto con el SKU ${conflict.sku}${conflict.barcode ? ` o el código ${conflict.barcode}` : ""}. No se importó ningún producto.`);
      }

      const products = parsed.map((product) => ({ product, id: randomUUID() }));
      await tx.shopProduct.createMany({
        data: products.map(({ product, id }) => ({
          id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          compatibility: product.compatibility,
          location: product.location,
          priceCents: product.priceArs,
          stock: product.initialStock,
          minimumStock: product.minimumStock,
          isActive: product.isActive,
        })),
      });
      await tx.inventoryMovement.createMany({
        data: products.map(({ product, id }) => ({
          productId: id,
          kind: "INITIAL",
          quantityDelta: product.initialStock,
          stockBefore: 0,
          stockAfter: product.initialStock,
          reason: "Importación desde Excel",
          reference: "Carga masiva",
          actorId,
          requestKey: product.requestKey,
          requestFingerprint: fingerprintFor("create", actorId, product),
        })),
      });
      return {
        count: parsed.length,
        initialUnits: parsed.reduce((total, product) => total + product.initialStock, 0),
      };
    });
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    if (isUniqueConstraintError(error)) throw new InventoryError("Otro cambio creó un SKU o código incluido en el Excel. No se importó ningún producto.");
    throw error;
  }
}

export async function updateInventoryProduct(prisma: PrismaClient, input: unknown): Promise<ShopProduct> {
  const parsed = updateInventoryProductSchema.parse(input);
  try {
    const result = await prisma.shopProduct.updateMany({
      where: { id: parsed.id, version: parsed.version },
      data: {
        sku: parsed.sku,
        barcode: parsed.barcode,
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        brand: parsed.brand,
        compatibility: parsed.compatibility,
        location: parsed.location,
        priceCents: parsed.priceArs,
        minimumStock: parsed.minimumStock,
        isActive: parsed.isActive,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) await throwProductVersionError(prisma, parsed.id);
    return await prisma.shopProduct.findUniqueOrThrow({ where: { id: parsed.id } });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new InventoryError("Ya existe un producto con ese SKU o código de barras.");
    throw error;
  }
}

export async function recordInventoryMovement(prisma: PrismaClient, input: unknown, actorId: string): Promise<ShopProduct> {
  const parsed = recordInventoryMovementSchema.parse(input);
  const fingerprint = fingerprintFor("movement", actorId, parsed);
  const alreadyRecorded = await idempotentProduct(prisma, parsed.requestKey, fingerprint);
  if (alreadyRecorded) return alreadyRecorded;

  try {
    return await withInventoryTransaction(prisma, async (tx) => {
      const existing = await idempotentProduct(tx, parsed.requestKey, fingerprint);
      if (existing) return existing;

      const current = await tx.shopProduct.findUnique({ where: { id: parsed.productId } });
      if (!current) throw new InventoryError("No encontramos el producto solicitado.");
      if (current.version !== parsed.version) throw staleVersionError();

      const movement = movementChange(parsed, current.stock, current.reservedStock);
      const updateResult = await tx.shopProduct.updateMany({
        where: movement.where,
        data: movement.data,
      });
      if (updateResult.count === 0) throw staleVersionError();

      const product = await tx.shopProduct.findUniqueOrThrow({ where: { id: current.id } });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          kind: parsed.kind,
          quantityDelta: movement.delta,
          stockBefore: current.stock,
          stockAfter: product.stock,
          reason: parsed.reason,
          reference: parsed.reference,
          actorId,
          requestKey: parsed.requestKey,
          requestFingerprint: fingerprint,
        },
      });
      return product;
    });
  } catch (error) {
    return resolveIdempotencyConflict(prisma, parsed.requestKey, fingerprint, error, "No se pudo registrar el movimiento de inventario.");
  }
}

function movementChange(input: RecordInventoryMovementInput, stock: number, reservedStock: number) {
  if (input.kind === "REPAIR") {
    if (stock - input.quantity < reservedStock) {
      throw new InventoryError("No hay stock disponible suficiente para registrar el consumo.");
    }
    return {
      delta: -input.quantity,
      where: { id: input.productId, version: input.version, stock: { gte: reservedStock + input.quantity } },
      data: { stock: { increment: -input.quantity }, version: { increment: 1 } },
    };
  }
  if (input.kind === "ADJUSTMENT") {
    if (input.quantity < reservedStock) {
      throw new InventoryError("El ajuste no puede dejar menos unidades que las ya reservadas.");
    }
    return {
      delta: input.quantity - stock,
      where: { id: input.productId, version: input.version, reservedStock: { lte: input.quantity } },
      data: { stock: input.quantity, version: { increment: 1 } },
    };
  }
  if (stock + input.quantity > 1_000_000) {
    throw new InventoryError("El stock físico no puede superar 1.000.000 de unidades.");
  }
  return {
    delta: input.quantity,
    where: { id: input.productId, version: input.version },
    data: { stock: { increment: input.quantity }, version: { increment: 1 } },
  };
}

async function idempotentProduct(client: InventoryClient, requestKey: string, fingerprint: string): Promise<ShopProduct | null> {
  const movement = await client.inventoryMovement.findUnique({ where: { requestKey } });
  if (!movement) return null;
  if (movement.requestFingerprint !== fingerprint) {
    throw new InventoryError("La clave de esta operación ya fue usada con datos diferentes.");
  }
  const product = await client.shopProduct.findUnique({ where: { id: movement.productId } });
  if (!product) throw new InventoryError("No se pudo recuperar el producto de la operación anterior.");
  return product;
}

async function resolveIdempotencyConflict(
  prisma: PrismaClient,
  requestKey: string,
  fingerprint: string,
  error: unknown,
  fallbackMessage: string,
): Promise<ShopProduct> {
  if (error instanceof InventoryError) throw error;
  if (isUniqueConstraintError(error)) {
    const existing = await idempotentProduct(prisma, requestKey, fingerprint);
    if (existing) return existing;
    throw new InventoryError(fallbackMessage);
  }
  throw error;
}

async function throwProductVersionError(prisma: PrismaClient, productId: string): Promise<never> {
  const product = await prisma.shopProduct.findUnique({ where: { id: productId } });
  if (!product) throw new InventoryError("No encontramos el producto solicitado.");
  throw staleVersionError();
}

function staleVersionError(): InventoryError {
  return new InventoryError("El producto fue actualizado por otra persona. Recargá la página e intentá de nuevo.");
}

async function withInventoryTransaction<T>(prisma: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationError(error) || attempt === 2) throw error;
    }
  }
  throw new Error("No se pudo completar la operación de inventario.");
}

function fingerprintFor(operation: "create" | "movement", actorId: string, input: CreateInventoryProductInput | RecordInventoryMovementInput): string {
  return createHash("sha256").update(JSON.stringify({ operation, actorId, input })).digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code === "P2002" : (error as { code?: string } | null)?.code === "P2002";
}

function isSerializationError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code === "P2034" : (error as { code?: string } | null)?.code === "P2034";
}

function duplicateValue(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}
