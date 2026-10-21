"use server";
import { logServerError } from "@/src/lib/safe-logging";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff } from "@/src/lib/staff-access";
import { cancelShopOrder, closeShopPaymentReview, shop, shopPaymentAvailable, syncShopOrder } from "@/src/lib/composition";
import { ShopOrderError } from "@/src/modules/shop/order-service";
import type { ShopActionResult } from "@/src/modules/shop/storefront-schemas";
import { db } from "@/src/lib/db";
import { saveCatalogDetails } from "@/src/modules/shop/catalog-service";

export async function saveCatalogDetailsAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  await requireStaff();
  try {
    await saveCatalogDetails(db, { id: form.get("id"), version: form.get("version"), images: JSON.parse(String(form.get("images"))), fitments: JSON.parse(String(form.get("fitments"))) });
    revalidate();
    revalidatePath(`/shop/product/${String(form.get("id"))}`);
    revalidatePath(`/internal/shop/inventory/${String(form.get("id"))}`);
    return { success: "Fotos y compatibilidades guardadas." };
  } catch (error) { return failure(error); }
}

export async function saveShopSettingsAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  await requireStaff({ role: "ADMIN" });
  try {
    const values = Object.fromEntries(form);
    if (form.has("checkoutEnabled") && !await shopPaymentAvailable()) throw new ShopOrderError("Configurá las credenciales de Mercado Pago antes de habilitar compras.");
    await shop.saveShopConfiguration({ ...values, checkoutEnabled: form.has("checkoutEnabled"), shippingEnabled: form.has("shippingEnabled") });
    revalidate();
    return { success: "Configuración de la tienda guardada." };
  } catch (error) { return failure(error); }
}

export async function publishProductAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  await requireStaff();
  try {
    await shop.publishShopProduct({ id: String(form.get("id")), version: form.get("version"), isPublished: form.has("isPublished") });
    revalidate();
    revalidatePath(`/internal/shop/inventory/${String(form.get("id"))}`);
    return { success: "Publicación actualizada." };
  } catch (error) { return failure(error); }
}

export async function updateShopOrderAction(_state: ShopActionResult, form: FormData): Promise<ShopActionResult> {
  const staff = await requireStaff();
  try {
    const id = String(form.get("id"));
    if (!/^[a-f0-9-]{36}$/u.test(id)) throw new ShopOrderError("Pedido inválido.");
    const target = String(form.get("target"));
    if (target === "SYNC") await syncShopOrder(id);
    else if (target === "CANCELLED") await cancelShopOrder(id, staff.userId);
    else if (target === "CLOSE_REVIEW") {
      await requireStaff({ role: "ADMIN" });
      await closeShopPaymentReview(id, staff.userId);
    }
    else if (["READY", "SHIPPED", "COMPLETED"].includes(target)) await shop.fulfillShopOrder(id, target as "READY" | "SHIPPED" | "COMPLETED", staff.userId, String(form.get("tracking") ?? ""));
    else throw new ShopOrderError("Acción inválida.");
    revalidate();
    return { success: "Pedido actualizado." };
  } catch (error) { return failure(error); }
}

function revalidate() {
  for (const path of ["/shop", "/shop/order", "/internal/shop", "/internal/shop/orders", "/internal/shop/store", "/internal/shop/inventory"]) revalidatePath(path);
}
function failure(error: unknown): ShopActionResult {
  if (error instanceof ShopOrderError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Revisá los datos." };
  logServerError("internal shop action failed", error);
  return { error: "No pudimos completar la operación. Volvé a intentarlo." };
}
