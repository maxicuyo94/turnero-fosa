import type { PrismaClient } from "@prisma/client";

/** Read models for the stock count pages. Writes go through `stock-count-service`. */

type StockCountReader = Pick<PrismaClient, "stockCount" | "stockCountLine" | "shopProduct">;

export const stockCountProductSelect = { id: true, name: true, sku: true, location: true, stock: true, reservedStock: true } as const;

/** The latest counts with how many lines each one already has counted. */
export async function listStockCounts(prisma: StockCountReader) {
  const counts = await prisma.stockCount.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, title: true, location: true, status: true, createdAt: true, closedAt: true,
      openedBy: { select: { name: true, username: true } },
      _count: { select: { lines: true } },
    },
  });
  const countedRows = await prisma.stockCountLine.groupBy({ by: ["countId"], where: { countId: { in: counts.map((count) => count.id) }, countedQuantity: { not: null } }, _count: { _all: true } });
  const counted = new Map(countedRows.map((row) => [row.countId, row._count._all]));
  return counts.map(({ _count, openedBy, ...count }) => ({ ...count, lines: _count.lines, counted: counted.get(count.id) ?? 0, openedBy: openedBy?.name ?? openedBy?.username ?? null }));
}

export function findStockCountDetail(prisma: StockCountReader, id: string) {
  return prisma.stockCount.findUnique({
    where: { id },
    select: {
      id: true, title: true, location: true, status: true, createdAt: true, closedAt: true, closeReason: true,
      openedBy: { select: { name: true, username: true } },
      closedBy: { select: { name: true, username: true } },
      lines: { orderBy: { product: { name: "asc" } }, select: { expectedStock: true, expectedMovements: true, countedQuantity: true, product: { select: stockCountProductSelect } } },
    },
  });
}

export function findStockCountProduct(prisma: StockCountReader, productId: string) {
  return prisma.shopProduct.findUniqueOrThrow({ where: { id: productId }, select: stockCountProductSelect });
}
