import { randomUUID } from "crypto";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { inventory } from "@/src/lib/composition";
import { normalizeScannedCode } from "@/src/modules/shop/inventory-code";
import { parseInventoryFilters, type InventoryFilterSearch } from "@/src/modules/shop/inventory-filters";
import { InventoryScreen, type InventoryListProduct } from "@/src/modules/shop/inventory-screen";

type Search = InventoryFilterSearch & { barcode?: string };

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const staff = await requireStaff();

  const raw = await searchParams;
  const filters = parseInventoryFilters(raw);
  const { products, categories, locations } = await inventory.listInventoryProducts(filters);
  return <InventoryScreen categories={categories} createRequestKey={randomUUID()} filters={filters} initialBarcode={normalizeScannedCode(raw?.barcode) ?? undefined} locations={locations} products={products as InventoryListProduct[]} canManageWorkshop={hasRole(staff, "ADMIN")} signedInUserName={staff.displayName} />;
}
