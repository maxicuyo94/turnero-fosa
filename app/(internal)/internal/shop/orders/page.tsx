import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { shop } from "@/src/lib/composition";
import { ShopOrdersScreen } from "@/src/modules/shop/store-management-screen";

export default async function OrdersPage() {
  const staff = await requireStaff();
  return <ShopOrdersScreen orders={await shop.internalOrders()} canManageWorkshop={hasRole(staff, "ADMIN")} signedInUserName={staff.displayName} />;
}
