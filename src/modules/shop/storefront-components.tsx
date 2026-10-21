"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/src/components/ui";
import { saveCart, useCart } from "./cart-storage";
import { money } from "./storefront-schemas";
import { useLastOrder } from "./shop-customer-state";
import { rememberCatalog, useCatalogReturn } from "./catalog-navigation";
import type { PublicProduct } from "./storefront-screen";
export const shopLinkClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus";
export function BackToCatalog({ children = "← Volver a repuestos" }: { children?: React.ReactNode }) {
  const href = useCatalogReturn();
  return <Link href={href} className={`${shopLinkClass} pl-0 text-action`}>{children}</Link>;
}
export function ProductVisual({ product, large = false, compact = false }: { product: PublicProduct; large?: boolean; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = product.images?.[0];
  return <div className={`relative flex items-center justify-center overflow-hidden rounded-control border border-border-subtle bg-surface-control ${large ? "aspect-square" : compact ? "aspect-square sm:aspect-[4/3]" : "aspect-[4/3]"}`}>
    {photo && !failed ? <Image src={photo.url} alt={photo.alt} fill sizes={large ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"} className="object-contain p-3" onError={() => setFailed(true)} /> : <div className="flex flex-col items-center gap-3 text-text-muted"><svg className={compact ? "h-10 w-10 sm:h-[76px] sm:w-[76px]" : undefined} width={large ? 112 : 76} height={large ? 112 : 76} viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m32 9 16 0 3 10 9 5 10-2 8 14-7 8v10l7 8-8 14-10-2-9 5-3 10H32l-3-10-9-5-10 2-8-14 7-8V44l-7-8 8-14 10 2 9-5 3-10Z" transform="translate(6 -3) scale(.85)" stroke="currentColor" strokeWidth="2"/><circle cx="40" cy="39" r="14" stroke="currentColor" strokeWidth="2"/></svg><span className={compact ? "text-[10px] sm:text-xs" : "text-xs"}>{failed ? "Foto no disponible" : "Foto pendiente"}</span></div>}
    {!product.available ? <span className={`${compact ? "hidden sm:inline-block" : ""} absolute left-3 top-3 rounded-control bg-surface-page px-3 py-2 text-xs font-bold text-text-secondary`}>Sin stock</span> : product.available <= 3 ? <span className={`${compact ? "hidden sm:inline-block" : ""} absolute left-3 top-3 rounded-control bg-action px-3 py-2 text-xs font-bold text-action-text`}>{product.available === 1 ? "Última unidad" : `Últimas ${product.available} unidades`}</span> : null}
  </div>;
}
export function AddToCart({ product }: { product: PublicProduct }) {
  const cart = useCart();
  const quantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
  const [notice, setNotice] = useState("");
  const limit = Math.min(product.available, 100);
  function add() {
    if (quantity >= limit || (!quantity && cart.length >= 50)) return;
    if (quantity) saveCart(cart.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    else saveCart([...cart, { productId: product.id, quantity: 1, unitPriceCents: product.priceCents }]);
    setNotice(`${product.name} agregado al carrito.`);
  }
  return <div><Button className="w-full" disabled={!product.available || quantity >= limit || (!quantity && cart.length >= 50)} onClick={add} aria-label={`Agregar ${product.name} al carrito`}>{!product.available ? "Sin stock" : quantity >= limit ? `${quantity} en carrito · límite alcanzado` : quantity ? `Agregar otro · ${quantity} en carrito` : "Agregar al carrito"}</Button><p className="sr-only" role="status" aria-live="polite">{notice}</p>{quantity ? <Link href="/shop/checkout" onClick={rememberCatalog} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-action">Ver carrito →</Link> : null}</div>;
}
export function CartLink({ fixed = false }: { fixed?: boolean }) {
  const cart = useCart();
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  if (fixed && !units) return null;
  return <div className={fixed ? "fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface-page p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden" : ""}><Link href="/shop/checkout" onClick={rememberCatalog} className={`${shopLinkClass} ${fixed ? "w-full bg-action text-action-text" : "border border-border-control text-action"}`}>{fixed ? "Ver carrito" : "Carrito"} <span>{units}</span>{units ? <span className="ml-2">· {money(total)}</span> : null}</Link></div>;
}
export function LastOrderLink() { const url = useLastOrder(); return url ? <Link href={url} className="inline-flex min-h-11 items-center text-sm font-bold text-action">Continuar o consultar mi último pedido →</Link> : null; }
