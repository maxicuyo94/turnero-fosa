"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";
const draftSchema = z.object({
  buyerKind: z.enum(["INDIVIDUAL", "MECHANIC"]).default("INDIVIDUAL"), deliveryKind: z.enum(["PICKUP", "SHIPPING"]).default("PICKUP"),
  workshopName: z.string().max(120).default(""), fullName: z.string().max(120).default(""), email: z.string().max(254).default(""), phone: z.string().max(40).default(""),
  address: z.string().max(250).default(""), city: z.string().max(100).default(""), province: z.string().max(100).default(""), postalCode: z.string().max(4).default(""),
});
export type CheckoutDraft = z.infer<typeof draftSchema>;
const draftKey = "shop-checkout-draft-v1";
const orderKey = "shop-last-order-v1";
function subscribe(callback: () => void) { window.addEventListener("shop-customer-state", callback); return () => window.removeEventListener("shop-customer-state", callback); }
function read(key: string) { try { const raw = sessionStorage.getItem(key) ?? ""; const saved = JSON.parse(raw); return saved.expiresAt > Date.now() ? raw : ""; } catch { return ""; } }
function write(key: string, value: unknown) { try { sessionStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event("shop-customer-state")); } catch { /* Checkout explains unavailable storage before creating an order. */ } }
export function useCheckoutDraft() {
  const raw = useSyncExternalStore(subscribe, () => read(draftKey), () => "");
  let draft = draftSchema.parse({});
  try { draft = draftSchema.parse(JSON.parse(raw).draft); } catch { /* Ignore invalid drafts. */ }
  return [draft, (changes: Partial<CheckoutDraft>) => write(draftKey, { draft: { ...draft, ...changes }, expiresAt: Date.now() + 2 * 60 * 60_000 })] as const;
}
export function rememberOrder(url: string) {
  if (/^\/shop\/order\?token=[a-f0-9]{64}$/u.test(url)) write(orderKey, { url, expiresAt: Date.now() + 24 * 60 * 60_000 });
  try { sessionStorage.removeItem(draftKey); } catch { /* Best effort. */ }
}
export function useLastOrder() {
  const raw = useSyncExternalStore(subscribe, () => read(orderKey), () => "");
  try { const value = JSON.parse(raw); return typeof value.url === "string" && /^\/shop\/order\?token=[a-f0-9]{64}$/u.test(value.url) ? value.url as string : null; } catch { return null; }
}
