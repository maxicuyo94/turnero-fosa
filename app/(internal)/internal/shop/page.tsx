import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { inventory } from "@/src/lib/composition";
import { ShopDashboardScreen, type InventoryListProduct } from "@/src/modules/shop/inventory-screen";

/** Internal inventory home. */
export default async function ShopPage() {
  const staff = await requireStaff();

  const dashboard = await inventory.getShopDashboard();
  return <ShopDashboardScreen activeProducts={dashboard.activeProducts} availableStockUnits={dashboard.availableStockUnits} lowStockProducts={dashboard.lowStockProducts} recentProducts={dashboard.recentProducts as InventoryListProduct[]} canManageWorkshop={hasRole(staff, "ADMIN")} signedInUserName={staff.displayName} stockUnits={dashboard.stockUnits} totalProducts={dashboard.totalProducts} />;
}
