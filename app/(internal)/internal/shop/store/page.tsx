import { requireStaff } from "@/src/lib/staff-access";
import { shop, shopPaymentAvailable } from "@/src/lib/composition";
import { ShopSettingsScreen } from "@/src/modules/shop/store-management-screen";

export default async function StoreSettingsPage() {
  const staff = await requireStaff({ role: "ADMIN" });
  const [config, paymentAvailable] = await Promise.all([shop.shopConfiguration(), shopPaymentAvailable()]);
  return <ShopSettingsScreen config={config} paymentAvailable={paymentAvailable} signedInUserName={staff.displayName} />;
}
