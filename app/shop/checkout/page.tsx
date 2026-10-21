import type { Metadata } from "next";
import { connection } from "next/server";
import { shop, shopPaymentAvailable } from "@/src/lib/composition";
import { ShopCheckoutScreen } from "@/src/modules/shop/checkout-screen";
export const metadata: Metadata = { title: "Tu carrito | Taller Express", robots: { index: false, follow: false } };
export default async function CheckoutPage() {
  await connection();
  const [products, config, paymentAvailable] = await Promise.all([shop.publicCatalog(), shop.shopConfiguration(), shopPaymentAvailable()]);
  return <ShopCheckoutScreen products={products} config={config} paymentAvailable={paymentAvailable} />;
}
