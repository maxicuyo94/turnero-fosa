import type { Metadata } from "next";
import { connection } from "next/server";
import { shop, shopPaymentAvailable, workshopContactSettings } from "@/src/lib/composition";
import { StorefrontScreen } from "@/src/modules/shop/storefront-screen";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";

export const metadata: Metadata = { title: "Repuestos | Taller Express", description: "Repuestos del taller para mecánicos y particulares." };
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const initialSearch = new URLSearchParams(Object.entries(await searchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])).toString();
  const [products, config, paymentAvailable, contact] = await Promise.all([shop.publicCatalog(), shop.shopConfiguration(), shopPaymentAvailable(), workshopContactSettings()]);
  return <><StorefrontScreen products={products} config={config} paymentAvailable={paymentAvailable} initialSearch={initialSearch} /><WorkshopContact settings={{ ...contact, depositRefundPolicy: null }} /></>;
}
