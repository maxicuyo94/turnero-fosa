import type { PrismaClient } from "@prisma/client";
import { applyStockFilter, inventoryWhere, type InventoryFilters } from "@/src/modules/shop/inventory-filters";

/** Read models for the inventory pages. Writes go through `inventory-service`, which audits stock. */

type InventoryReader = Pick<PrismaClient, "shopProduct">;

const listProductSelect = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  category: true,
  brand: true,
  location: true,
  priceCents: true,
  stock: true,
  reservedStock: true,
  minimumStock: true,
  isActive: true,
} as const;

/** Inventory home. It intentionally contains no sales metrics until point-of-sale exists. */
export async function getShopDashboard(prisma: InventoryReader) {
  const [totalProducts, activeProducts, stock, lowStockRows, recentProducts] = await Promise.all([
    prisma.shopProduct.count(),
    prisma.shopProduct.count({ where: { isActive: true } }),
    prisma.shopProduct.aggregate({ _sum: { stock: true, reservedStock: true } }),
    prisma.shopProduct.findMany({ select: { stock: true, reservedStock: true, minimumStock: true } }),
    prisma.shopProduct.findMany({ orderBy: { createdAt: "desc" }, select: listProductSelect, take: 6 }),
  ]);
  const stockUnits = stock._sum.stock ?? 0;
  return {
    totalProducts,
    activeProducts,
    stockUnits,
    availableStockUnits: stockUnits - (stock._sum.reservedStock ?? 0),
    lowStockProducts: lowStockRows.filter((product) => product.stock - product.reservedStock <= product.minimumStock).length,
    recentProducts,
  };
}

export async function listInventoryProducts(prisma: InventoryReader, filters: InventoryFilters) {
  const [rows, categoryRows, locations] = await Promise.all([
    prisma.shopProduct.findMany({ where: inventoryWhere(filters), select: listProductSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.shopProduct.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    listInventoryLocations(prisma),
  ]);
  return { products: applyStockFilter(filters, rows), categories: categoryRows.map((row) => row.category), locations };
}

export async function listInventoryLocations(prisma: InventoryReader): Promise<string[]> {
  const rows = await prisma.shopProduct.findMany({ where: { location: { not: null } }, distinct: ["location"], orderBy: { location: "asc" }, select: { location: true } });
  return rows.flatMap((row) => row.location ? [row.location] : []);
}

export function findInventoryProductDetail(prisma: InventoryReader, id: string, historyLimit: number) {
  return prisma.shopProduct.findUnique({
    where: { id },
    select: {
      id: true, sku: true, barcode: true, name: true, description: true, category: true, brand: true,
      compatibility: true, location: true, priceCents: true, stock: true, reservedStock: true,
      minimumStock: true, isActive: true, version: true, updatedAt: true,
      movements: {
        take: historyLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, kind: true, quantityDelta: true, stockBefore: true, stockAfter: true, reason: true,
          reference: true, createdAt: true,
          actor: { select: { name: true, username: true, email: true } },
        },
      },
    },
  });
}

/** One product (`id`) or what the list shows with the same filters, up to `limit` rows. */
export function listLabelProducts(prisma: InventoryReader, selection: { id?: string; filters: InventoryFilters }, limit: number) {
  return prisma.shopProduct.findMany({
    where: selection.id ? { id: selection.id } : inventoryWhere(selection.filters),
    select: { id: true, sku: true, name: true, location: true, priceCents: true, stock: true, reservedStock: true, minimumStock: true },
    orderBy: [{ location: "asc" }, { name: "asc" }],
    take: limit,
  });
}

/** Products without a barcode that an unknown scanned code could be linked to. */
export function listBarcodeLinkCandidates(prisma: InventoryReader, query: string, limit: number) {
  return prisma.shopProduct.findMany({
    where: {
      barcode: null,
      ...(query ? { OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
      ] } : {}),
    },
    select: { id: true, sku: true, barcode: true, name: true, location: true, version: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
