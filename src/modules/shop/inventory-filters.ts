import type { Prisma } from "@prisma/client";

export type InventoryFilters = { q: string; status: string; category: string; location: string };
export type InventoryFilterSearch = Partial<Record<keyof InventoryFilters, string | string[]>>;

/** Filtros del listado leidos de la URL; el listado y las etiquetas comparten la misma seleccion. */
export function parseInventoryFilters(raw: InventoryFilterSearch | undefined): InventoryFilters {
  const status = first(raw?.status) ?? "";
  return {
    q: clean(first(raw?.q), 120),
    status: ["active", "inactive", "low"].includes(status) ? status : "",
    category: clean(first(raw?.category), 80),
    location: clean(first(raw?.location), 120),
  };
}

export function inventoryWhere(filters: InventoryFilters): Prisma.ShopProductWhereInput {
  return {
    ...(filters.status === "active" ? { isActive: true } : filters.status === "inactive" ? { isActive: false } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.location ? { location: filters.location } : {}),
    ...(filters.q ? { OR: [
      { name: { contains: filters.q, mode: "insensitive" } },
      { sku: { contains: filters.q, mode: "insensitive" } },
      { barcode: { contains: filters.q, mode: "insensitive" } },
      { brand: { contains: filters.q, mode: "insensitive" } },
      { compatibility: { contains: filters.q, mode: "insensitive" } },
      { location: { contains: filters.q, mode: "insensitive" } },
    ] } : {}),
  };
}

/** "En minimo" compara disponible contra minimo, algo que Prisma no filtra en la consulta. */
export function applyStockFilter<T extends { stock: number; reservedStock: number; minimumStock: number }>(filters: InventoryFilters, rows: T[]): T[] {
  return filters.status === "low" ? rows.filter((product) => product.stock - product.reservedStock <= product.minimumStock) : rows;
}

export function inventoryFilterQuery(filters: InventoryFilters): string {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | undefined, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
