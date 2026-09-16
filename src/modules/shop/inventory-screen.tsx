"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Card, EmptyState, Field, PageHeading, Select, SiteHeader, TextInput, Textarea } from "@/src/components/ui";
import { signOutAction } from "@/app/(internal)/internal/actions";
import {
  createInventoryProductAction,
  recordInventoryMovementAction,
  updateInventoryProductAction,
} from "@/app/(internal)/internal/shop/actions";
import { shopInitialActionState, type ShopActionState } from "@/src/modules/shop/inventory-action-state";

export type InventoryListProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand: string | null;
  location: string | null;
  priceCents: number;
  stock: number;
  reservedStock: number;
  minimumStock: number;
  isActive: boolean;
};

export type InventoryDetailProduct = InventoryListProduct & {
  description: string | null;
  compatibility: string | null;
  version: number;
  updatedAt: Date;
};

export type InventoryHistoryItem = {
  id: string;
  kind: "INITIAL" | "RECEIPT" | "ADJUSTMENT" | "REPAIR";
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  reference: string | null;
  createdAt: Date;
  actor: { name: string | null; username: string | null; email: string } | null;
};

export function ShopDashboardScreen({
  totalProducts,
  activeProducts,
  lowStockProducts,
  stockUnits,
  availableStockUnits,
  recentProducts,
  signedInUserName,
}: {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  stockUnits: number;
  availableStockUnits: number;
  recentProducts: InventoryListProduct[];
  signedInUserName?: string | null;
}) {
  return (
    <ShopShell active="summary" signedInUserName={signedInUserName}>
      <PageHeading
        eyebrow="Taller · stock"
        title="Inventario"
        description="Controlá repuestos, existencias y reposiciones desde un solo lugar."
        action={<Link className="rounded-xl bg-apple-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-apple-300" href="/internal/shop/inventory">Ver inventario</Link>}
      />
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de inventario">
        <Metric label="Repuestos" value={totalProducts} note={`${activeProducts} activos`} />
        <Metric label="Unidades físicas" value={stockUnits} note="Stock cargado" />
        <Metric label="Para revisar" value={lowStockProducts} note="En mínimo o por debajo" alert={lowStockProducts > 0} />
        <Metric label="Disponibilidad" value={availableStockUnits} note="Físico menos reservado" />
      </section>
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div><h2 className="font-bold text-white">Últimos repuestos</h2><p className="mt-1 text-sm text-zinc-500">Alta reciente en el inventario.</p></div>
            <Link className="text-sm font-bold text-apple-300 hover:text-apple-200" href="/internal/shop/inventory">Ver todos</Link>
          </div>
          {recentProducts.length ? <div className="divide-y divide-white/10">{recentProducts.map((product) => <InventoryRow key={product.id} product={product} />)}</div> : <EmptyState className="m-6">Todavía no hay repuestos cargados. Creá el primero para empezar a controlar el stock.</EmptyState>}
        </Card>
        <Card className="flex flex-col justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-apple-300">Operación rápida</p><h2 className="mt-3 text-2xl font-black tracking-tight text-white">Cargá un repuesto real</h2><p className="mt-3 leading-6 text-zinc-400">Incluí su ubicación y stock inicial. Los cambios de cantidad quedan registrados como movimientos.</p></div>
          <Link className="mt-8 inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white hover:bg-white/[0.08]" href="/internal/shop/inventory#nuevo">Nuevo repuesto</Link>
        </Card>
      </section>
    </ShopShell>
  );
}

export function InventoryScreen({
  products,
  categories,
  locations,
  filters,
  createRequestKey,
  signedInUserName,
}: {
  products: InventoryListProduct[];
  categories: string[];
  locations: string[];
  filters: { q: string; status: string; category: string; location: string };
  createRequestKey: string;
  signedInUserName?: string | null;
}) {
  return (
    <ShopShell active="inventory" signedInUserName={signedInUserName}>
      <PageHeading eyebrow="Taller · stock" title="Repuestos" description="Buscá por nombre, SKU o código de barras. Las cantidades se actualizan desde cada ficha." action={<a className="rounded-xl bg-apple-400 px-5 py-3 text-sm font-black text-zinc-950 hover:bg-apple-300" href="#nuevo">Nuevo repuesto</a>} />
      <Card className="mt-8" aria-label="Filtros de inventario">
        <form className="grid min-w-0 gap-3 [&_input]:min-w-0 [&_input]:w-full [&_select]:min-w-0 [&_select]:w-full md:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem_auto]" method="get">
          <TextInput aria-label="Buscar repuesto" defaultValue={filters.q} density="sm" name="q" placeholder="Buscar por nombre, SKU o código" />
          <Select aria-label="Estado" defaultValue={filters.status} density="sm" name="status"><option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="low">En mínimo</option></Select>
          <Select aria-label="Categoría" defaultValue={filters.category} density="sm" name="category"><option value="">Todas las categorías</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
          <Select aria-label="Ubicación" defaultValue={filters.location} density="sm" name="location"><option value="">Todas las ubicaciones</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
          <Button className="justify-self-start" type="submit">Filtrar</Button>
        </form>
      </Card>
      <Card padding="none" className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5"><div><h2 className="font-bold text-white">Listado</h2><p className="mt-1 text-sm text-zinc-500">{products.length} {products.length === 1 ? "resultado" : "resultados"}</p></div></div>
        {products.length ? <div className="divide-y divide-white/10">{products.map((product) => <InventoryRow key={product.id} product={product} />)}</div> : <EmptyState className="m-6">No encontramos repuestos con esos filtros.</EmptyState>}
      </Card>
      <NewProductForm requestKey={createRequestKey} />
    </ShopShell>
  );
}

export function InventoryProductScreen({ product, history, historyLimit, movementRequestKey, signedInUserName }: { product: InventoryDetailProduct; history: InventoryHistoryItem[]; historyLimit: number; movementRequestKey: string; signedInUserName?: string | null }) {
  const available = product.stock - product.reservedStock;
  return (
    <ShopShell active="inventory" signedInUserName={signedInUserName}>
      <Link className="text-sm font-bold text-zinc-400 hover:text-white" href="/internal/shop/inventory">← Volver a inventario</Link>
      <div className="mt-7 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="break-all font-mono text-xs font-bold tracking-[0.18em] text-apple-300">{product.sku}</p><h1 className="mt-2 break-words text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">{product.name}</h1><p className="mt-3 break-words text-zinc-400">{product.category}{product.brand ? ` · ${product.brand}` : ""}{product.location ? ` · ${product.location}` : ""}</p></div><StatusChip active={product.isActive} /></div>
      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Stock actual"><Metric label="Físico" value={product.stock} note="Unidades en taller" /><Metric label="Reservado" value={product.reservedStock} note="Para pedidos futuros" /><Metric label="Disponible" value={available} note={`Mínimo: ${product.minimumStock}`} alert={available <= product.minimumStock} /></section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <ProductForm product={product} />
        <MovementForm product={product} requestKey={movementRequestKey} />
      </section>
      <Card padding="none" className="mt-6 overflow-hidden">
        <div className="flex items-start justify-between gap-5 border-b border-white/10 px-6 py-5"><div><h2 className="font-bold text-white">Historial de movimientos</h2><p className="mt-1 text-sm text-zinc-500">Se muestran los últimos {historyLimit}. El historial no se puede editar ni borrar.</p></div></div>
        {history.length ? <ol className="divide-y divide-white/10">{history.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</ol> : <EmptyState className="m-6">No hay movimientos registrados todavía.</EmptyState>}
      </Card>
    </ShopShell>
  );
}

function ShopShell({ active, children, signedInUserName }: { active: "summary" | "inventory"; children: ReactNode; signedInUserName?: string | null }) {
  return (
    <>
      <SiteHeader active="internal" linkComponent={Link} onSignOut={signOutAction} userName={signedInUserName} />
      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-6 lg:py-10">
        <nav aria-label="Secciones internas" className="mb-8 flex min-w-0 gap-2 overflow-x-auto border-b border-white/10 whitespace-nowrap">
          <ShopNavLink href="/internal">Agenda</ShopNavLink>
          <ShopNavLink active={active === "summary"} href="/internal/shop">Resumen</ShopNavLink>
          <ShopNavLink active={active === "inventory"} href="/internal/shop/inventory">Inventario</ShopNavLink>
        </nav>
        {children}
      </main>
    </>
  );
}

function ShopNavLink({ active = false, href, children }: { active?: boolean; href: string; children: string }) {
  return <Link aria-current={active ? "page" : undefined} className={`border-b-2 px-4 py-3 text-sm font-black transition sm:px-5 ${active ? "border-apple-400 text-white" : "border-transparent text-zinc-500 hover:text-white"}`} href={href}>{children}</Link>;
}

function NewProductForm({ requestKey }: { requestKey: string }) {
  const [state, action] = useActionState(createInventoryProductAction, shopInitialActionState);
  return <Card className="mt-8 scroll-mt-6" aria-label="Nuevo repuesto"><div id="nuevo"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-apple-300">Alta de inventario</p><h2 className="mt-3 text-2xl font-black text-white">Nuevo repuesto</h2><p className="mt-2 text-sm leading-6 text-zinc-400">El stock inicial crea un movimiento de auditoría. Después, usá la ficha para ajustar cantidades.</p></div><ProductFields formAction={action} requestKey={requestKey} state={state} includeInitialStock /><ActionFeedback state={state} successHref={state.productId ? `/internal/shop/inventory/${state.productId}` : undefined} successLabel="Abrir ficha" /></Card>;
}

function ProductForm({ product }: { product: InventoryDetailProduct }) {
  const [state, action] = useActionState(updateInventoryProductAction, shopInitialActionState);
  return <Card aria-label="Editar ficha"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-apple-300">Ficha de producto</p><h2 className="mt-3 text-2xl font-black text-white">Datos del repuesto</h2><ProductFields key={product.version} formAction={action} product={product} state={state} version={String(product.version)} /><ActionFeedback state={state} /></Card>;
}

function ProductFields({ formAction, state, product, version, requestKey, includeInitialStock = false }: { formAction: (payload: FormData) => void; state: ShopActionState; product?: InventoryDetailProduct; version?: string; requestKey?: string; includeInitialStock?: boolean }) {
  const values = product && state.status === "error" && state.values?.version === String(product.version) ? state.values : !product ? state.values : undefined;
  const value = (field: keyof InventoryDetailProduct | "priceArs" | "initialStock") => values?.[field] ?? (field === "priceArs" ? formatPrice(product?.priceCents) : field === "initialStock" ? "0" : String(product?.[field as keyof InventoryDetailProduct] ?? ""));
  const baseId = product?.id ?? "new";
  return (
    <form action={formAction} className="mt-6 grid min-w-0 gap-4 [&_input]:min-w-0 [&_input:not([type=checkbox])]:w-full [&_textarea]:min-w-0 [&_textarea]:w-full sm:grid-cols-2">
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="version" value={version ?? ""} />
      {requestKey ? <RequestKey initialKey={requestKey} state={state} /> : null}
      <Field label="Nombre" htmlFor={`${baseId}-name`} className="sm:col-span-2"><TextInput id={`${baseId}-name`} name="name" defaultValue={value("name")} required /></Field>
      <Field label="SKU" hint="único" htmlFor={`${baseId}-sku`}><TextInput id={`${baseId}-sku`} mono name="sku" defaultValue={value("sku")} required /></Field>
      <Field label="Código de barras" hint="opcional" htmlFor={`${baseId}-barcode`}><TextInput id={`${baseId}-barcode`} name="barcode" defaultValue={value("barcode")} inputMode="numeric" /></Field>
      <Field label="Categoría" htmlFor={`${baseId}-category`}><TextInput id={`${baseId}-category`} name="category" defaultValue={value("category")} required /></Field>
      <Field label="Marca" hint="opcional" htmlFor={`${baseId}-brand`}><TextInput id={`${baseId}-brand`} name="brand" defaultValue={value("brand")} /></Field>
      <Field label="Precio (ARS)" htmlFor={`${baseId}-price`}><TextInput id={`${baseId}-price`} name="priceArs" defaultValue={value("priceArs")} inputMode="decimal" placeholder="0,00" required /></Field>
      <Field label="Stock mínimo" htmlFor={`${baseId}-minimum`}><TextInput id={`${baseId}-minimum`} name="minimumStock" defaultValue={value("minimumStock")} inputMode="numeric" required /></Field>
      {includeInitialStock ? <Field label="Stock físico inicial" htmlFor="new-initial"><TextInput id="new-initial" name="initialStock" defaultValue={value("initialStock")} inputMode="numeric" required /></Field> : null}
      <Field label="Ubicación" hint="opcional" htmlFor={`${baseId}-location`} className={includeInitialStock ? "" : "sm:col-span-2"}><TextInput id={`${baseId}-location`} name="location" defaultValue={value("location")} placeholder="Ej. Estante A · Caja 2" /></Field>
      <Field label="Compatibilidad" hint="opcional" htmlFor={`${baseId}-compatibility`} className="sm:col-span-2"><TextInput id={`${baseId}-compatibility`} name="compatibility" defaultValue={value("compatibility")} placeholder="Ej. Honda Wave 110, 2020–2024" /></Field>
      <Field label="Descripción" hint="opcional" htmlFor={`${baseId}-description`} className="sm:col-span-2"><Textarea id={`${baseId}-description`} name="description" defaultValue={value("description")} /></Field>
      <label className="flex items-center gap-3 text-sm text-zinc-300 sm:col-span-2"><input name="isActive" type="hidden" value="false" /><input className="h-4 w-4 accent-[#8EE000]" defaultChecked={(values?.isActive ?? String(product?.isActive ?? true)) === "true"} name="isActive" type="checkbox" value="true" />Activo para operar</label>
      <SubmitButton label={product ? "Guardar ficha" : "Crear repuesto"} />
    </form>
  );
}

function MovementForm({ product, requestKey }: { product: InventoryDetailProduct; requestKey: string }) {
  const [state, action] = useActionState(recordInventoryMovementAction, shopInitialActionState);
  const values = state.status === "error" && state.values?.version === String(product.version) ? state.values : undefined;
  return <Card aria-label="Registrar movimiento"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-apple-300">Stock físico</p><h2 className="mt-3 text-2xl font-black text-white">Registrar movimiento</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Cada operación requiere un motivo y queda en el historial.</p><MovementFields key={product.version} formAction={action} product={product} requestKey={requestKey} state={state} values={values} /><ActionFeedback state={state} /></Card>;
}

function MovementFields({ formAction, product, requestKey, state, values }: { formAction: (payload: FormData) => void; product: InventoryDetailProduct; requestKey: string; state: ShopActionState; values?: Record<string, string> }) { return <form action={formAction} className="mt-6 grid min-w-0 gap-4 [&_input]:min-w-0 [&_input]:w-full [&_select]:min-w-0 [&_select]:w-full [&_textarea]:min-w-0 [&_textarea]:w-full"><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="version" value={product.version} /><RequestKey initialKey={requestKey} state={state} /><Field label="Tipo" htmlFor="movement-kind"><Select id="movement-kind" name="kind" defaultValue={values?.kind ?? "RECEIPT"}><option value="RECEIPT">Entrada de mercadería</option><option value="REPAIR">Consumo en reparación</option><option value="ADJUSTMENT">Ajuste por conteo</option></Select></Field><Field label="Cantidad" hint="en ajuste es el nuevo físico" htmlFor="movement-quantity"><TextInput id="movement-quantity" name="quantity" defaultValue={values?.quantity ?? ""} inputMode="numeric" required /></Field><Field label="Motivo" htmlFor="movement-reason"><Textarea id="movement-reason" name="reason" defaultValue={values?.reason ?? ""} placeholder="Ej. Ingreso de proveedor, orden 142" required /></Field><Field label="Referencia" hint="opcional" htmlFor="movement-reference"><TextInput id="movement-reference" name="reference" defaultValue={values?.reference ?? ""} placeholder="Factura, orden o remito" /></Field><SubmitButton label="Registrar movimiento" /></form>; }

function RequestKey({ initialKey, state }: { initialKey: string; state: ShopActionState }) { return <input type="hidden" name="requestKey" value={state.status === "error" ? state.values?.requestKey ?? initialKey : initialKey} />; }
function SubmitButton({ label }: { label: string }) { const { pending } = useFormStatus(); return <Button className="mt-2 justify-self-start" disabled={pending} type="submit">{pending ? "Guardando…" : label}</Button>; }
function ActionFeedback({ state, successHref, successLabel }: { state: ShopActionState; successHref?: string; successLabel?: string }) { if (state.status === "idle") return null; return <Alert className="mt-5" tone={state.status === "success" ? "success" : "danger"}>{state.message}{successHref && successLabel ? <Link className="ml-2 font-bold underline" href={successHref}>{successLabel}</Link> : null}</Alert>; }
function Metric({ label, value, note, alert = false }: { label: string; value: number; note: string; alert?: boolean }) { return <Card className={alert ? "border-apple-400/40" : ""}><p className="text-sm text-zinc-400">{label}</p><p className={alert ? "mt-3 text-4xl font-black text-apple-300" : "mt-3 text-4xl font-black text-white"}>{number(value)}</p><p className="mt-2 text-xs text-zinc-500">{note}</p></Card>; }
function InventoryRow({ product }: { product: InventoryListProduct }) { const available = product.stock - product.reservedStock; const low = available <= product.minimumStock; return <Link className="grid min-w-0 gap-3 px-6 py-5 transition hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" href={`/internal/shop/inventory/${product.id}`}><div className="min-w-0"><p className="break-words font-bold text-white">{product.name}</p><p className="mt-1 break-words font-mono text-xs tracking-wide text-zinc-500">{product.sku}{product.location ? ` · ${product.location}` : ""}</p><p className="mt-2 text-sm font-semibold text-zinc-300">{formatArs(product.priceCents)}</p></div><div className="text-left sm:text-right"><p className={low ? "font-black text-apple-300" : "font-black text-white"}>{number(available)} disp.</p><p className="mt-1 text-xs text-zinc-500">Físico {number(product.stock)} · Reservado {number(product.reservedStock)}</p></div><StatusChip active={product.isActive} low={low} /></Link>; }
function MovementRow({ movement }: { movement: InventoryHistoryItem }) { const delta = movement.quantityDelta; const actor = movement.actor?.name ?? movement.actor?.username ?? movement.actor?.email ?? "Sistema"; return <li className="grid min-w-0 gap-3 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="min-w-0"><p className="font-bold text-white">{movementLabel(movement.kind)} <span className={delta >= 0 ? "text-apple-300" : "text-red-300"}>{delta >= 0 ? "+" : ""}{number(delta)}</span></p><p className="mt-1 break-words text-sm text-zinc-400">{movement.reason}{movement.reference ? ` · ${movement.reference}` : ""}</p><p className="mt-2 break-words text-xs text-zinc-600">{formatDate(movement.createdAt)} · {actor}</p></div><p className="text-sm text-zinc-400">{number(movement.stockBefore)} → <span className="font-bold text-white">{number(movement.stockAfter)}</span></p></li>; }
function StatusChip({ active, low }: { active: boolean; low?: boolean }) { return <span className={low ? "w-fit rounded-full bg-apple-400/15 px-3 py-1 text-xs font-bold text-apple-300" : active ? "w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300" : "w-fit rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-500"}>{low ? "En mínimo" : active ? "Activo" : "Inactivo"}</span>; }
function formatPrice(value?: number) { return value === undefined ? "" : (value / 100).toFixed(2).replace(".", ","); }
function formatArs(value: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100); }
function number(value: number) { return new Intl.NumberFormat("es-AR").format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)); }
function movementLabel(kind: InventoryHistoryItem["kind"]) { return ({ INITIAL: "Stock inicial", RECEIPT: "Entrada", ADJUSTMENT: "Ajuste", REPAIR: "Consumo en reparación" })[kind]; }
