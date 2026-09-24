import type { Metadata } from "next";
import { requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { applyStockFilter, inventoryFilterQuery, inventoryWhere, parseInventoryFilters, type InventoryFilterSearch } from "@/src/modules/shop/inventory-filters";
import { InventoryLabelsScreen, MAX_LABEL_COPIES, MAX_LABEL_PRODUCTS } from "@/src/modules/shop/inventory-labels";

export const metadata: Metadata = { title: "Etiquetas de inventario" };

type Search = InventoryFilterSearch & { id?: string | string[]; copies?: string | string[] };

/** Etiquetas de un repuesto (`?id=`) o de lo que muestra el listado con los mismos filtros. */
export default async function InventoryLabelsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  await requireStaff();

  const raw = (await searchParams) ?? {};
  const id = first(raw.id)?.slice(0, 128);
  const filters = parseInventoryFilters(raw);
  const rows = await db.shopProduct.findMany({
    where: id ? { id } : inventoryWhere(filters),
    select: { id: true, sku: true, name: true, location: true, priceCents: true, stock: true, reservedStock: true, minimumStock: true },
    orderBy: [{ location: "asc" }, { name: "asc" }],
    // Uno de mas para saber si la seleccion quedo recortada.
    take: MAX_LABEL_PRODUCTS + 1,
  });
  const products = id ? rows : applyStockFilter(filters, rows);
  const selection = id ? `id=${encodeURIComponent(id)}` : inventoryFilterQuery(filters);

  return (
    <InventoryLabelsScreen
      backHref={id ? `/internal/shop/inventory/${id}` : `/internal/shop/inventory${selection ? `?${selection}` : ""}`}
      copies={copiesFrom(first(raw.copies))}
      copiesQuery={selection}
      products={products.slice(0, MAX_LABEL_PRODUCTS)}
      truncated={rows.length > MAX_LABEL_PRODUCTS}
    />
  );
}

function copiesFrom(value: string | undefined) {
  const copies = Number(value);
  return Number.isInteger(copies) ? Math.min(Math.max(copies, 1), MAX_LABEL_COPIES) : 1;
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
