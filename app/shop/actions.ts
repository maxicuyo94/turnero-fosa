"use server";
import { logServerError } from "@/src/lib/safe-logging";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { allowShopAttempt, shop, shopCheckout, shopPaymentAvailable, syncShopOrder } from "@/src/lib/composition";
import { clientIpFromHeaders } from "@/src/lib/rate-limit";
import { ShopOrderError } from "@/src/modules/shop/order-service";
import { verifyBotProtection } from "@/src/lib/bot-protection";
import type { ShopActionResult } from "@/src/modules/shop/storefront-schemas";

export async function createShopOrderAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  if (!await allowShopAttempt(clientIpFromHeaders(await headers()))) return { error: "Llegaste al límite de intentos. Probá más tarde." };
  try {
    if (!await shopPaymentAvailable()) return { error: "El pago online todavía no está disponible." };
    if (!await verifyBotProtection(form, "shop")) return { error: "Completá la verificación y volvé a intentar." };
    const fields = ["requestKey", "accessToken", "buyerKind", "fullName", "email", "phone", "workshopName", "deliveryKind", "address", "city", "province", "postalCode"];
    const values = Object.fromEntries(fields.map((name) => [name, form.get(name) ?? undefined]));
    const items = JSON.parse(String(form.get("items")));
    await shop.reserveShopOrder({ ...values, items, shippingFeeCents: Number(form.get("shippingFeeCents")) });
    revalidatePath("/shop");
    revalidatePath("/internal/shop");
    return { orderUrl: `/shop/order?${new URLSearchParams({ token: String(form.get("accessToken")) })}` };
  } catch (error) { return failure(error); }
}

export async function payShopOrderAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  let url: string;
  try {
    if (!await allowShopAttempt(clientIpFromHeaders(await headers()))) return { error: "Llegaste al límite de intentos. Probá más tarde." };
    url = await shopCheckout(String(form.get("token")));
  } catch (error) { return failure(error); }
  redirect(url);
}

export async function refreshShopOrderAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  try {
    if (!await allowShopAttempt(clientIpFromHeaders(await headers()))) return { error: "Llegaste al límite de consultas. Probá más tarde." };
    const order = await shop.publicOrder(String(form.get("token")));
    if (!order) return { error: "No se encontró el pedido." };
    await syncShopOrder(order.id);
    revalidatePath("/shop/order");
    return { success: "Estado actualizado." };
  } catch (error) { return failure(error); }
}

function failure(error: unknown): ShopActionResult {
  if (error instanceof ShopOrderError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Revisá los datos." };
  if (error instanceof SyntaxError) return { error: "El carrito no es válido. Recargá la tienda." };
  logServerError("shop action failed", error);
  return { error: "No pudimos completar la operación. Podés volver a intentarlo." };
}
