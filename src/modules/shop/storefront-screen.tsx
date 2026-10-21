"use client";

import Link from "next/link";
import { Alert, Button, Card, EmptyState, Field, PageHeading, PageShell, Select, SiteHeader, TextInput } from "@/src/components/ui";
import { money } from "./storefront-schemas";
import { normalizeSearch } from "./catalog-schemas";
import { AddToCart, CartLink, LastOrderLink, ProductVisual } from "./storefront-components";
import { rememberCatalog, useCatalogFilters } from "./catalog-navigation";

export type PublicProduct = {
  id: string; sku: string; name: string; category: string; brand: string | null;
  description: string | null; compatibility: string | null; priceCents: number; available: number;
  images?: { url: string; alt: string }[];
  fitments?: { yearFrom: number | null; yearTo: number | null; vehicleModel: { id: string; brand: string; model: string; variant: string } }[];
};
export type PublicShopConfig = { checkoutEnabled: boolean; shippingEnabled: boolean; shippingFeeCents: number; shippingPostalCodes: string[]; pickupInstructions: string };

export function StorefrontScreen({ products, config, paymentAvailable, initialSearch = "" }: { products: PublicProduct[]; config: PublicShopConfig; paymentAvailable: boolean; initialSearch?: string }) {
  const { query, category, vehicle, year, inStock, sort, update } = useCatalogFilters(initialSearch);
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const models = [...new Map(products.flatMap((p) => p.fitments ?? []).map((f) => [f.vehicleModel.id, f.vehicleModel])).values()].sort((a,b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  const words = normalizeSearch(query).split(/\s+/u).filter(Boolean);
  const visible = products.filter((p) => {
    const haystack = normalizeSearch([p.name, p.sku, p.brand, p.compatibility, ...(p.fitments ?? []).map((f) => `${f.vehicleModel.brand} ${f.vehicleModel.model} ${f.vehicleModel.variant}`)].join(" "));
    return (!category || p.category === category) && (!inStock || p.available > 0) && words.every((word) => haystack.includes(word)) && (!vehicle || p.fitments?.some((f) => f.vehicleModel.id === vehicle && (!year || ((f.yearFrom === null || Number(year) >= f.yearFrom) && (f.yearTo === null || Number(year) <= f.yearTo)))));
  }).sort((a,b) => sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : sort === "name" ? a.name.localeCompare(b.name, "es-AR") : Number(b.available > 0) - Number(a.available > 0) || a.name.localeCompare(b.name,"es-AR"));
  function reset() { update({ q: "", category: "", vehicle: "", year: "", stock: "", sort: "" }); }
  return <><SiteHeader active="shop" linkComponent={Link} /><PageShell className="pb-28 lg:pb-10">
    <div className="flex flex-wrap items-start justify-between gap-5"><PageHeading className="[&_h1]:text-3xl sm:[&_h1]:text-5xl" eyebrow="Repuestos del taller" title="El repuesto para tu próxima salida." description="Buscá por nombre o código. Revisá la compatibilidad y elegí retiro o envío." /><div className="hidden lg:block"><CartLink /></div></div>
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary"><span>Precios en pesos argentinos</span><span>Compra sin crear cuenta</span><span>{config.shippingEnabled ? "Retiro en taller o envío en Salta capital" : "Retiro en taller"}</span></div>
    <LastOrderLink />
    {!config.checkoutEnabled || !paymentAvailable ? <Alert className="mt-5">Podés explorar y armar tu carrito. Estamos preparando el pago online; todavía no está habilitado.</Alert> : null}
    <Card className="mt-7"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]"><Field label="Buscar repuesto" htmlFor="shop-query"><TextInput type="search" value={query} onChange={(e) => update({ q: e.target.value })} placeholder="Nombre, marca, modelo o código" /></Field><Field label="Categoría" htmlFor="shop-category"><Select value={category} onChange={(e) => update({ category: e.target.value })}><option value="">Todas las categorías</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
      {models.length ? <details className="mt-4" open={vehicle ? true : undefined}><summary className="min-h-11 cursor-pointer py-3 font-bold text-action">Buscar por mi moto</summary><div className="grid gap-4 sm:grid-cols-2"><Field label="Marca, modelo y versión" htmlFor="shop-vehicle"><Select value={vehicle} onChange={(e) => update({ vehicle: e.target.value, year: "" })}><option value="">Elegí tu moto</option>{models.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.model} {m.variant}</option>)}</Select></Field><Field label="Año" htmlFor="shop-year" hint={vehicle ? "Opcional" : "Elegí primero tu moto"}><TextInput disabled={!vehicle} type="number" min={1900} max={2100} value={year} onChange={(e) => update({ year: e.target.value })} /></Field></div><p className="mt-3 text-sm text-text-muted">El filtro muestra las compatibilidades registradas por el taller. Revisá la ficha y la referencia antes de comprar.</p></details> : <p className="mt-3 text-sm text-text-muted">¿Tenés dudas sobre la pieza? Revisá su ficha y consultá al taller antes de comprar.</p>}
    </Card>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-text-secondary">{visible.length} {visible.length === 1 ? "repuesto" : "repuestos"}</p><div className="flex flex-wrap items-center gap-4"><label className="flex min-h-11 items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={inStock} onChange={(e) => update({ stock: e.target.checked ? "1" : "" })} className="h-5 w-5 accent-lime-400" />Solo disponibles</label><Field label="Ordenar" htmlFor="shop-sort"><Select value={sort} onChange={(e) => update({ sort: e.target.value })}><option value="available">Disponibles primero</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre</option></Select></Field></div></div>
    {query || category || vehicle || inStock ? <div aria-label="Filtros activos" className="mb-5 flex flex-wrap gap-2">
      {query ? <Button variant="secondary" className="max-w-full [overflow-wrap:anywhere]" onClick={() => update({ q: "" })} aria-label="Quitar búsqueda">{query} ×</Button> : null}
      {category ? <Button variant="secondary" className="max-w-full [overflow-wrap:anywhere]" onClick={() => update({ category: "" })} aria-label="Quitar categoría">{category} ×</Button> : null}
      {vehicle ? <Button variant="secondary" className="max-w-full [overflow-wrap:anywhere]" onClick={() => update({ vehicle: "", year: "" })} aria-label="Quitar filtro de moto">{models.find((m) => m.id === vehicle)?.model ?? "Mi moto"}{year ? ` · ${year}` : ""} ×</Button> : null}
      {inStock ? <Button variant="secondary" className="max-w-full [overflow-wrap:anywhere]" onClick={() => update({ stock: "" })} aria-label="Quitar filtro de disponibilidad">Disponibles ×</Button> : null}
      <Button variant="ghost" onClick={reset}>Limpiar todos</Button>
    </div> : null}
    {visible.length ? <section aria-label="Catálogo de repuestos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((p) => <Card key={p.id} className="flex min-w-0 gap-4 sm:flex-col">
      <Link href={`/shop/product/${p.id}`} onClick={rememberCatalog} aria-label={`Ver ficha de ${p.name}`} className="w-24 shrink-0 self-start sm:w-full"><ProductVisual product={p} compact /></Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs font-bold uppercase tracking-widest text-action">{p.category}</p>
        <h2 className="mt-2 text-base font-bold text-text-primary sm:text-xl"><Link className="hover:underline" href={`/shop/product/${p.id}`} onClick={rememberCatalog}>{p.name}</Link></h2>
        <p className="mt-1 text-sm text-text-muted">{p.brand ?? "Repuesto del taller"}</p>
        <p className="mt-2 text-xs font-bold text-text-secondary sm:hidden">{!p.available ? "Sin stock" : p.available === 1 ? "Última unidad" : p.available <= 3 ? `Últimas ${p.available} unidades` : "Disponible"}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary">{p.compatibility ? `Compatibilidad: ${p.compatibility}` : "Consultá la compatibilidad en la ficha."}</p>
        <p className="mt-2 break-all text-xs text-text-muted">Código: {p.sku}</p>
        <div className="mt-auto pt-4"><p className="mb-3 text-xl font-black text-text-primary sm:text-2xl">{money(p.priceCents)}</p><AddToCart product={p} /></div>
      </div>
    </Card>)}</section> : <EmptyState><p>{products.length ? "No encontramos repuestos con esos filtros." : "Pronto vas a encontrar acá los repuestos del taller."}</p>{products.length ? <Button className="mt-4" variant="secondary" onClick={reset}>Limpiar filtros</Button> : null}</EmptyState>}
    <CartLink fixed />
  </PageShell></>;
}
