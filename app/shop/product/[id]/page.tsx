import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/src/lib/db";
import { workshopContactSettings } from "@/src/lib/composition";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";
import { publicProduct } from "@/src/modules/shop/storefront-queries";
import { AddToCart, BackToCatalog, CartLink, ProductVisual, shopLinkClass } from "@/src/modules/shop/storefront-components";
import { Card, PageShell, SiteHeader } from "@/src/components/ui";
import { money } from "@/src/modules/shop/storefront-schemas";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await publicProduct(db, (await params).id);
  return { title: product ? `${product.name} | Repuestos del taller` : "Repuesto no disponible", description: product?.description?.slice(0,160) ?? undefined };
}
export default async function ProductPage({ params }: Props) {
  await connection();
  const [product, contact] = await Promise.all([publicProduct(db, (await params).id), workshopContactSettings()]);
  if (!product) notFound();
  return <><SiteHeader active="shop" linkComponent={Link} /><PageShell className="pb-28 lg:pb-10"><div className="flex flex-wrap items-center justify-between gap-3"><BackToCatalog /><CartLink /></div>
    <div className="mt-6 grid items-start gap-7 md:grid-cols-2"><div className="space-y-4"><ProductVisual product={product} large />{product.images.slice(1).map((image) => <ProductVisual key={image.url} product={{ ...product, images: [image] }} />)}</div><Card><p className="text-xs font-bold uppercase tracking-widest text-action">{product.category}</p><h1 className="mt-3 text-3xl font-black text-text-primary">{product.name}</h1><p className="mt-2 text-text-secondary">{product.brand ?? "Repuesto del taller"}</p><p className="mt-3 break-all text-sm text-text-muted">Código: {product.sku}</p><p className="mt-6 text-3xl font-black text-text-primary">{money(product.priceCents)}</p><p className="my-4 text-sm text-text-secondary">{product.available ? `Disponible · ${product.available === 1 ? "última unidad" : `${product.available} unidades`}` : "Sin stock por el momento"}</p><AddToCart product={product} />
      <h2 className="mt-7 text-lg font-bold text-text-primary">Compatibilidad</h2>{product.fitments.length ? <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">{product.fitments.map((f) => <li key={f.vehicleModel.id}>{f.vehicleModel.brand} {f.vehicleModel.model} {f.vehicleModel.variant}{f.yearFrom || f.yearTo ? ` · ${f.yearFrom && f.yearTo ? `${f.yearFrom}–${f.yearTo}` : f.yearFrom ? `Desde ${f.yearFrom}` : `Hasta ${f.yearTo}`}` : ""}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-text-secondary">{product.compatibility ?? "Consultá al taller para confirmar si sirve para tu moto."}</p>}<p className="mt-3 text-sm leading-6 text-text-muted">Verificá modelo, año y referencia de la pieza antes de comprar. Si tenés dudas, consultanos.</p>
      {contact.whatsappNumber ? <a href={`https://wa.me/${contact.whatsappNumber.replace(/\D/gu, "")}?text=${encodeURIComponent(`Hola, quiero confirmar si ${product.name} (código ${product.sku}) sirve para mi moto.`)}`} className={`${shopLinkClass} mt-4 border border-border-control text-action`}>Consultar compatibilidad</a> : contact.publicPhone ? <a href={`tel:${contact.publicPhone.replace(/[^+\d]/gu, "")}`} className={`${shopLinkClass} mt-4 border border-border-control text-action`}>Consultar compatibilidad</a> : null}
      {product.description ? <><h2 className="mt-7 text-lg font-bold text-text-primary">Sobre este repuesto</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-text-secondary">{product.description}</p></> : null}
    </Card></div><CartLink fixed /></PageShell><WorkshopContact settings={{ ...contact, depositRefundPolicy: null }} /></>;
}
