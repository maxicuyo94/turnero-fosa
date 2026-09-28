import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { inventory, stockCounts } from "@/src/lib/composition";
import { StockCountsScreen } from "@/src/modules/shop/stock-count-screen";

export default async function StockCountsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const staff = await requireStaff();
  const error = (await searchParams)?.error?.slice(0, 300);
  const [counts, locations] = await Promise.all([stockCounts.listStockCounts(), inventory.listInventoryLocations()]);
  return (
    <StockCountsScreen
      canManageWorkshop={hasRole(staff, "ADMIN")}
      counts={counts}
      error={error}
      locations={locations}
      signedInUserName={staff.displayName}
    />
  );
}
