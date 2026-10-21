"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

const key = "taller-shop-cart-v1";
const savedCart = z.array(z.object({ productId: z.string().max(128), quantity: z.number().int().min(1).max(100), unitPriceCents: z.number().int().min(1).max(100_000_000) })).max(50);
export type CartItem = z.infer<typeof savedCart>[number];
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("shop-cart", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("shop-cart", callback); };
}
function snapshot() { try { return localStorage.getItem(key) ?? "[]"; } catch { return "[]"; } }
export function saveCart(items: CartItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); window.dispatchEvent(new Event("shop-cart")); } catch { /* The UI explains when persistence is unavailable at checkout. */ }
}
export function useCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try { const parsed = savedCart.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : []; } catch { return []; }
}
