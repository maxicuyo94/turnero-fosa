import { randomUUID } from "crypto";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { normalizeScannedCode } from "@/src/modules/shop/inventory-code";
import { applyStockFilter, inventoryWhere, parseInventoryFilters, type InventoryFilterSearch } from "@/src/modules/shop/inventory-filters";
import { InventoryScreen, type InventoryListProduct } from "@/src/modules/shop/inventory-screen";

const productSelect = {
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

type Search = InventoryFilterSearch & { barcode?: string };

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const staff = await requireStaff();

  const raw = await searchParams;
  const filters = parseInventoryFilters(raw);
  const where = inventoryWhere(filters);
  const [rows, categoryRows, locationRows] = await Promise.all([
    db.shopProduct.findMany({ where, select: productSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.shopProduct.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    db.shopProduct.findMany({ where: { location: { not: null } }, distinct: ["location"], orderBy: { location: "asc" }, select: { location: true } }),
  ]);
  const products = applyStockFilter(filters, rows);
  return <InventoryScreen categories={categoryRows.map((row) => row.category)} createRequestKey={randomUUID()} filters={filters} initialBarcode={normalizeScannedCode(raw?.barcode) ?? undefined} locations={locationRows.flatMap((row) => row.location ? [row.location] : [])} products={products as InventoryListProduct[]} canManageWorkshop={hasRole(staff, "ADMIN")} signedInUserName={staff.displayName} />;
}
