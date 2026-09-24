import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { InventoryError } from "@/src/modules/shop/inventory-service";

const MAX_COUNT_LINES = 2_000;
const MAX_QUANTITY = 1_000_000;

const openSchema = z.object({
  title: z.string().trim().max(120, "El nombre no puede superar 120 caracteres.").nullish().transform((value) => value || null),
  location: z.string().trim().max(120).nullish().transform((value) => value || null),
});

const countedSchema = z.object({
  countId: z.string().trim().min(1).max(128),
  productId: z.string().trim().min(1).max(128),
  // Vacio vuelve la linea a "sin contar"; cero es un conteo explicito.
  quantity: z.union([z.string(), z.number(), z.null()]).transform((value, ctx) => {
    const raw = typeof value === "number" ? String(value) : value?.trim() ?? "";
    if (raw === "") return null;
    if (!/^\d+$/u.test(raw) || Number(raw) > MAX_QUANTITY) {
      ctx.addIssue({ code: "custom", message: "Ingresá una cantidad entera entre 0 y 1.000.000." });
      return z.NEVER;
    }
    return Number(raw);
  }),
});

const lineSchema = z.object({ countId: z.string().trim().min(1).max(128), productId: z.string().trim().min(1).max(128) });

const closeSchema = z.object({
  countId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1, "Indicá el motivo del ajuste.").max(500, "El motivo no puede superar 500 caracteres."),
});

export type StockCountIssue = { productId: string; name: string; kind: "moved" | "reserved" };

/** Productos que impiden aplicar el conteo; el taller los resuelve y vuelve a intentar. */
export class StockCountConflictError extends InventoryError {
  constructor(readonly issues: StockCountIssue[]) {
    super(issues.length === 1
      ? `Revisá "${issues[0].name}" antes de aplicar el conteo.`
      : `Revisá ${issues.length} repuestos antes de aplicar el conteo.`);
    this.name = "StockCountConflictError";
  }
}

/** Abre un conteo con la foto del stock actual; no modifica existencias. */
export async function openStockCount(prisma: PrismaClient, input: unknown, actorId: string) {
  const parsed = openSchema.parse(input);
  return withCountTransaction(prisma, async (tx) => {
    const products = await tx.shopProduct.findMany({
      where: parsed.location ? { location: parsed.location } : {},
      select: { id: true, stock: true },
      orderBy: { name: "asc" },
      take: MAX_COUNT_LINES + 1,
    });
    if (!products.length) throw new InventoryError(parsed.location ? "No hay repuestos en esa ubicación." : "No hay repuestos para contar.");
    if (products.length > MAX_COUNT_LINES) throw new InventoryError("Son más de 2.000 repuestos: contá por ubicación.");
    const movements = await movementCounts(tx, products.map((product) => product.id));
    return tx.stockCount.create({
      data: {
        title: parsed.title ?? (parsed.location ? `Conteo de ${parsed.location}` : "Conteo completo"),
        location: parsed.location,
        openedById: actorId,
        lines: { create: products.map((product) => ({ productId: product.id, expectedStock: product.stock, expectedMovements: movements.get(product.id) ?? 0 })) },
      },
      select: { id: true },
    });
  });
}

/**
 * Guarda lo contado para un repuesto. Reemplaza el valor anterior en lugar de sumarlo, asi una
 * lectura repetida no agrega unidades. Un repuesto encontrado fuera del alcance se suma al conteo.
 */
export async function recordCountedQuantity(prisma: PrismaClient, input: unknown, actorId: string) {
  const parsed = countedSchema.parse(input);
  return withCountTransaction(prisma, async (tx) => {
    await requireOpenCount(tx, parsed.countId);
    const counted = { countedQuantity: parsed.quantity, countedById: parsed.quantity === null ? null : actorId, countedAt: parsed.quantity === null ? null : new Date() };
    const line = await tx.stockCountLine.findUnique({ where: { countId_productId: { countId: parsed.countId, productId: parsed.productId } }, select: { id: true } });
    if (line) return tx.stockCountLine.update({ where: { id: line.id }, data: counted });
    const product = await tx.shopProduct.findUnique({ where: { id: parsed.productId }, select: { id: true, stock: true } });
    if (!product) throw new InventoryError("No encontramos el repuesto.");
    const movements = await movementCounts(tx, [product.id]);
    return tx.stockCountLine.create({
      data: { countId: parsed.countId, productId: product.id, expectedStock: product.stock, expectedMovements: movements.get(product.id) ?? 0, ...counted },
    });
  });
}

/** El repuesto se movio durante el conteo: toma el stock actual como base y pide contarlo de nuevo. */
export async function recountStockCountLine(prisma: PrismaClient, input: unknown) {
  const parsed = lineSchema.parse(input);
  return withCountTransaction(prisma, async (tx) => {
    await requireOpenCount(tx, parsed.countId);
    const product = await tx.shopProduct.findUnique({ where: { id: parsed.productId }, select: { stock: true } });
    if (!product) throw new InventoryError("No encontramos el repuesto.");
    const movements = await movementCounts(tx, [parsed.productId]);
    return tx.stockCountLine.update({
      where: { countId_productId: parsed },
      data: { expectedStock: product.stock, expectedMovements: movements.get(parsed.productId) ?? 0, countedQuantity: null, countedById: null, countedAt: null },
    });
  });
}

/**
 * Aplica las diferencias contadas como ajustes, todos o ninguno. Rechaza el conteo si un repuesto
 * se movio desde su base o si lo contado no cubre sus reservas. Repetirlo no ajusta dos veces.
 */
export async function applyStockCount(prisma: PrismaClient, input: unknown, actorId: string) {
  const parsed = closeSchema.parse(input);
  return withCountTransaction(prisma, async (tx) => {
    const count = await tx.stockCount.findUnique({ where: { id: parsed.countId }, select: { id: true, title: true, status: true } });
    if (!count) throw new InventoryError("No encontramos el conteo.");
    if (count.status === "APPLIED") return adjustmentSummary(tx, count.id);
    if (count.status === "CANCELLED") throw new InventoryError("El conteo fue cancelado.");

    const lines = await tx.stockCountLine.findMany({
      where: { countId: count.id, countedQuantity: { not: null } },
      select: { productId: true, expectedStock: true, expectedMovements: true, countedQuantity: true, product: { select: { name: true, stock: true, reservedStock: true } } },
    });
    if (!lines.length) throw new InventoryError("Todavía no contaste ningún repuesto.");
    const movements = await movementCounts(tx, lines.map((line) => line.productId));
    const issues = lines.flatMap((line): StockCountIssue[] => {
      if (line.product.stock !== line.expectedStock || (movements.get(line.productId) ?? 0) !== line.expectedMovements) return [{ productId: line.productId, name: line.product.name, kind: "moved" }];
      if (line.countedQuantity! < line.product.reservedStock) return [{ productId: line.productId, name: line.product.name, kind: "reserved" }];
      return [];
    });
    if (issues.length) throw new StockCountConflictError(issues);

    for (const line of lines) {
      const counted = line.countedQuantity!;
      if (counted === line.expectedStock) continue;
      const updated = await tx.shopProduct.updateMany({
        where: { id: line.productId, stock: line.expectedStock, reservedStock: { lte: counted } },
        data: { stock: counted, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new StockCountConflictError([{ productId: line.productId, name: line.product.name, kind: "moved" }]);
      const requestKey = `stock-count:${count.id}:${line.productId}`;
      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          kind: "ADJUSTMENT",
          quantityDelta: counted - line.expectedStock,
          stockBefore: line.expectedStock,
          stockAfter: counted,
          reason: `${count.title}: ${parsed.reason}`,
          reference: `Conteo ${count.id}`,
          actorId,
          requestKey,
          requestFingerprint: createHash("sha256").update(requestKey).digest("hex"),
        },
      });
    }
    const closed = await tx.stockCount.updateMany({
      where: { id: count.id, status: "OPEN" },
      data: { status: "APPLIED", closedById: actorId, closedAt: new Date(), closeReason: parsed.reason },
    });
    if (closed.count !== 1) throw new InventoryError("Otra persona cerró el conteo. Recargá la página.");
    return adjustmentSummary(tx, count.id);
  });
}

/** Descarta un conteo abierto sin tocar el stock. */
export async function cancelStockCount(prisma: PrismaClient, input: unknown, actorId: string) {
  const parsed = closeSchema.parse(input);
  const closed = await prisma.stockCount.updateMany({
    where: { id: parsed.countId, status: "OPEN" },
    data: { status: "CANCELLED", closedById: actorId, closedAt: new Date(), closeReason: parsed.reason },
  });
  if (closed.count !== 1) throw new InventoryError("El conteo ya estaba cerrado.");
}

/** Lineas marcadas para revision: movidas desde su base o con menos unidades que las reservadas. */
export function stockCountLineIssue(line: { expectedStock: number; expectedMovements: number; countedQuantity: number | null; product: { stock: number; reservedStock: number; movements: number } }): StockCountIssue["kind"] | null {
  if (line.product.stock !== line.expectedStock || line.product.movements !== line.expectedMovements) return "moved";
  if (line.countedQuantity !== null && line.countedQuantity < line.product.reservedStock) return "reserved";
  return null;
}

export async function movementCounts(client: Pick<Prisma.TransactionClient, "inventoryMovement">, productIds: string[]) {
  const rows = await client.inventoryMovement.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _count: { _all: true } });
  return new Map(rows.map((row) => [row.productId, row._count._all]));
}

async function adjustmentSummary(tx: Prisma.TransactionClient, countId: string) {
  const adjusted = await tx.inventoryMovement.count({ where: { requestKey: { startsWith: `stock-count:${countId}:` } } });
  return { countId, adjusted };
}

async function requireOpenCount(tx: Prisma.TransactionClient, countId: string) {
  const count = await tx.stockCount.findUnique({ where: { id: countId }, select: { status: true } });
  if (!count) throw new InventoryError("No encontramos el conteo.");
  if (count.status !== "OPEN") throw new InventoryError("El conteo ya está cerrado.");
}

async function withCountTransaction<T>(prisma: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 2) throw error;
    }
  }
}
