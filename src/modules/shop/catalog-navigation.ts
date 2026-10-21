"use client";

import { useSyncExternalStore } from "react";

const keys = ["q", "category", "vehicle", "year", "stock", "sort"] as const;
type FilterKey = typeof keys[number];
const returnKey = "shop-catalog-return-v1";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("shop-catalog-navigation", callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener("shop-catalog-navigation", callback); };
}
export function catalogUrl(search: string) {
  const incoming = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = incoming.get(key)?.slice(0, 160);
    if (value) params.set(key, value);
  }
  return `/shop${params.size ? `?${params}` : ""}`;
}
export function useCatalogFilters(initialSearch = "") {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => initialSearch);
  const params = new URLSearchParams(search);
  function update(changes: Partial<Record<FilterKey, string>>) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    window.history.replaceState(null, "", catalogUrl(next.toString()));
    window.dispatchEvent(new Event("shop-catalog-navigation"));
  }
  return {
    query: params.get("q") ?? "", category: params.get("category") ?? "", vehicle: params.get("vehicle") ?? "",
    year: params.get("year") ?? "", inStock: params.get("stock") === "1", sort: params.get("sort") ?? "available", update,
  };
}
export function rememberCatalog() {
  if (window.location.pathname !== "/shop") return;
  try { sessionStorage.setItem(returnKey, JSON.stringify({ url: catalogUrl(window.location.search), expiresAt: Date.now() + 2 * 60 * 60_000 })); } catch { /* Navigation works without storage. */ }
}
function readReturn() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(returnKey) ?? "null");
    if (saved?.expiresAt > Date.now() && typeof saved.url === "string" && /^\/shop(?:\?|$)/u.test(saved.url)) {
      return catalogUrl(saved.url.slice(5));
    }
  } catch { /* Ignore invalid saved navigation. */ }
  return "/shop";
}
export function useCatalogReturn() { return useSyncExternalStore(subscribe, readReturn, () => "/shop"); }
