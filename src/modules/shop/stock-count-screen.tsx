"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Alert, Button, Card, EmptyState, Field, PageHeading, Select, TextInput, Textarea } from "@/src/components/ui";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";
import {
  applyStockCountAction,
  cancelStockCountAction,
  openStockCountAction,
  recordCountedQuantityAction,
  recountStockCountLineAction,
} from "@/app/(internal)/internal/shop/counts/actions";
import { BarcodeScanner } from "@/src/modules/shop/barcode-scanner";
import { ShopShell } from "@/src/modules/shop/inventory-screen";
import { InternalBackLink } from "@/src/modules/internal/internal-shell";

type CountStatus = "OPEN" | "APPLIED" | "CANCELLED";
type CountView = "all" | "pending" | "diff" | "review";

export type StockCountListItem = { id: string; title: string; location: string | null; status: CountStatus; createdAt: Date; closedAt: Date | null; lines: number; counted: number; openedBy: string | null };

export type StockCountRow = {
  expectedStock: number;
  countedQuantity: number | null;
  issue: "moved" | "reserved" | null;
  product: { id: string; name: string; sku: string; location: string | null; stock: number; reservedStock: number };
};

type StockCountDetail = { id: string; title: string; location: string | null; status: CountStatus; createdAt: Date; closedAt: Date | null; closeReason: string | null; openedBy: string | null; closedBy: string | null };

export function StockCountsScreen({ counts, locations, error, signedInUserName, canManageWorkshop }: { counts: StockCountListItem[]; locations: string[]; error?: string; signedInUserName?: string | null; canManageWorkshop?: boolean }) {
  return (
    <ShopShell active="counts" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}>
      <PageHeading eyebrow="Taller · stock" title="Conteos" description="Contá el stock físico desde el celular. Nada cambia hasta que revisás las diferencias y aplicás el conteo." />
      {error ? <Alert className="mt-6" tone="danger">{error}</Alert> : null}
      <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card aria-label="Nuevo conteo">
          <h2 className="text-2xl font-black text-white">Nuevo conteo</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Se toma el stock registrado de cada repuesto como base. Si alguno se mueve mientras contás, queda marcado para recontar.</p>
          <form action={openStockCountAction} className="mt-6 grid gap-4 [&_input]:w-full [&_select]:w-full">
            <Field label="Qué contar" htmlFor="count-location"><Select id="count-location" name="location" defaultValue=""><option value="">Todo el inventario</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</Select></Field>
            <Field label="Nombre" hint="opcional" htmlFor="count-title"><TextInput id="count-title" name="title" placeholder="Ej. Conteo de fin de mes" /></Field>
            <SubmitButton label="Empezar conteo" pendingLabel="Preparando…" />
          </form>
        </Card>
        <Card padding="none" className="overflow-hidden" aria-label="Conteos recientes">
          <div className="border-b border-white/10 px-6 py-5"><h2 className="font-bold text-white">Recientes</h2></div>
          {counts.length ? (
            <ul className="divide-y divide-white/10">{counts.map((count) => (
              <li key={count.id}><Link className="flex min-w-0 flex-col gap-2 px-6 py-5 transition hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between" href={`/internal/shop/counts/${count.id}`}>
                <div className="min-w-0"><p className="break-words font-bold text-white">{count.title}</p><p className="mt-1 text-xs text-zinc-500">{formatDate(count.createdAt)}{count.openedBy ? ` · ${count.openedBy}` : ""}</p></div>
                <div className="flex items-center gap-3"><span className="text-sm text-zinc-400">{count.counted} de {count.lines} contados</span><StatusChip status={count.status} /></div>
              </Link></li>
            ))}</ul>
          ) : <EmptyState className="m-6">Todavía no hay conteos.</EmptyState>}
        </Card>
      </section>
    </ShopShell>
  );
}

export function StockCountScreen({ count, rows, focus, inScope, view, notice, error, signedInUserName, canManageWorkshop }: { count: StockCountDetail; rows: StockCountRow[]; focus?: StockCountRow; inScope: boolean; view: CountView; notice?: string; error?: string; signedInUserName?: string | null; canManageWorkshop?: boolean }) {
  const open = count.status === "OPEN";
  const counted = rows.filter((row) => row.countedQuantity !== null);
  const differences = counted.filter((row) => row.countedQuantity !== row.expectedStock);
  const review = rows.filter((row) => row.issue);
  const visible = { all: rows, pending: rows.filter((row) => row.countedQuantity === null), diff: differences, review }[view];
  const views: { value: CountView; label: string; total: number }[] = [
    { value: "all", label: "Todos", total: rows.length },
    { value: "pending", label: "Sin contar", total: rows.length - counted.length },
    { value: "diff", label: "Con diferencia", total: differences.length },
    { value: "review", label: "Para revisar", total: review.length },
  ];
  return (
    <ShopShell active="counts" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}>
      <InternalBackLink href="/internal/shop/counts">Volver a conteos</InternalBackLink>
      <div className="mt-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><h1 className="break-words text-4xl font-black tracking-[-0.04em] text-white">{count.title}</h1><p className="mt-2 text-sm text-zinc-400">{count.location ?? "Todo el inventario"} · abierto {formatDate(count.createdAt)}{count.openedBy ? ` por ${count.openedBy}` : ""}</p></div>
        <StatusChip status={count.status} />
      </div>
      {notice ? <Alert className="mt-6" tone="success">{notice}</Alert> : null}
      {error ? <Alert className="mt-6" tone="danger">{error}</Alert> : null}
      {!open ? <Alert className="mt-6" tone="info">{count.status === "APPLIED" ? "Aplicado" : "Cancelado"} {count.closedAt ? formatDate(count.closedAt) : ""}{count.closedBy ? ` por ${count.closedBy}` : ""}{count.closeReason ? `: ${count.closeReason}` : ""}.</Alert> : null}
      {open ? <CountScanner countId={count.id} focus={focus} inScope={inScope} view={view} /> : null}
      <nav aria-label="Filtrar líneas" className="mt-8 flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap">
        {views.map((item) => <Link aria-current={item.value === view ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-bold ${item.value === view ? "border-apple-400/60 bg-apple-400/10 text-white" : "border-white/10 text-zinc-400 hover:text-white"}`} href={item.value === "all" ? `/internal/shop/counts/${count.id}` : `/internal/shop/counts/${count.id}?view=${item.value}`} key={item.value}>{item.label} · {item.total}</Link>)}
      </nav>
      <Card padding="none" className="mt-4 overflow-hidden" aria-label="Líneas del conteo">
        {visible.length ? <ul className="divide-y divide-white/10">{visible.map((row) => <CountLine countId={count.id} key={row.product.id} open={open} row={row} view={view} />)}</ul> : <EmptyState className="m-6">No hay repuestos en esta vista.</EmptyState>}
      </Card>
      {open ? <CloseCount countId={count.id} counted={counted.length} differences={differences.length} review={review.length} /> : null}
    </ShopShell>
  );
}

function CountScanner({ countId, focus, inScope, view }: { countId: string; focus?: StockCountRow; inScope: boolean; view: CountView }) {
  const router = useRouter();
  return (
    <Card className="mt-8" aria-label="Contar un repuesto">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-white">Contar</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Escaneá o escribí el código y cargá cuántas unidades hay físicamente, incluidas las reservadas. Volver a escanear reemplaza la cantidad, no la suma.</p>
          <form className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end" method="get">
            <Field className="min-w-0 flex-1" label="Código o SKU" htmlFor="count-code"><TextInput autoComplete="off" autoFocus={!focus} className="w-full min-w-0" enterKeyHint="search" id="count-code" name="code" required /></Field>
            <Button className="justify-self-start" type="submit" variant="ghost">Buscar</Button>
          </form>
          {focus ? (
            <form action={recordCountedQuantityAction} className="mt-6 rounded-2xl border border-apple-400/40 bg-apple-400/[0.06] p-5" key={focus.product.id}>
              <input name="countId" type="hidden" value={countId} />
              <input name="productId" type="hidden" value={focus.product.id} />
              <input name="view" type="hidden" value={view} />
              <p className="break-words text-lg font-black text-white">{focus.product.name}</p>
              <p className="mt-1 break-words font-mono text-xs text-zinc-400">{focus.product.sku}{focus.product.location ? ` · ${focus.product.location}` : ""}</p>
              {!inScope ? <p className="mt-2 text-sm text-apple-300">No estaba en este conteo: al guardarlo se agrega.</p> : null}
              <p className="mt-3 text-sm text-zinc-400">Registrado {number(focus.expectedStock)} · Reservado {number(focus.product.reservedStock)}{focus.countedQuantity !== null ? ` · Ya contado: ${number(focus.countedQuantity)}` : ""}</p>
              <div className="mt-4 flex items-end gap-3">
                <Field className="w-36" label="Unidades contadas" htmlFor="focus-quantity"><TextInput autoFocus className="w-full" defaultValue={focus.countedQuantity ?? ""} id="focus-quantity" inputMode="numeric" name="quantity" required /></Field>
                <SubmitButton label="Guardar" />
              </div>
            </form>
          ) : null}
        </div>
        <BarcodeScanner onDetected={(code) => router.push(`/internal/shop/counts/${countId}?${new URLSearchParams({ code, ...(view === "all" ? {} : { view }) })}`)} />
      </div>
    </Card>
  );
}

function CountLine({ countId, row, open, view }: { countId: string; row: StockCountRow; open: boolean; view: CountView }) {
  const difference = row.countedQuantity === null ? null : row.countedQuantity - row.expectedStock;
  return (
    <li className="grid min-w-0 gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="break-words font-bold text-white">{row.product.name}</p>
        <p className="mt-1 break-words font-mono text-xs text-zinc-500">{row.product.sku}{row.product.location ? ` · ${row.product.location}` : ""}</p>
        <p className="mt-2 text-sm text-zinc-400">Registrado {number(row.expectedStock)} · Reservado {number(row.product.reservedStock)} · {row.countedQuantity === null ? <span className="text-zinc-500">Sin contar</span> : <>Contado <span className="font-bold text-white">{number(row.countedQuantity)}</span></>}{difference ? <span className={difference > 0 ? " font-bold text-apple-300" : " font-bold text-red-300"}> ({difference > 0 ? "+" : ""}{number(difference)})</span> : null}</p>
        {row.issue === "moved" ? <p className="mt-2 text-sm text-red-300">Se movió durante el conteo (ahora {number(row.product.stock)} registradas). Recontalo antes de aplicar.</p> : null}
        {row.issue === "reserved" ? <p className="mt-2 text-sm text-red-300">Lo contado no cubre las {number(row.product.reservedStock)} unidades reservadas. Revisá las reservas o volvé a contar.</p> : null}
      </div>
      {open ? (
        <div className="flex flex-wrap items-end gap-2">
          {row.issue === "moved" ? (
            <form action={recountStockCountLineAction}><input name="countId" type="hidden" value={countId} /><input name="productId" type="hidden" value={row.product.id} /><input name="view" type="hidden" value={view} /><SubmitButton label="Recontar" variant="ghost" /></form>
          ) : (
            <form action={recordCountedQuantityAction} className="flex items-end gap-2">
              <input name="countId" type="hidden" value={countId} /><input name="productId" type="hidden" value={row.product.id} /><input name="view" type="hidden" value={view} />
              <TextInput aria-label={`Unidades contadas de ${row.product.name}`} className="w-24" defaultValue={row.countedQuantity ?? ""} density="sm" inputMode="numeric" key={row.countedQuantity ?? "none"} name="quantity" placeholder="—" />
              <SubmitButton label="Guardar" variant="ghost" />
            </form>
          )}
        </div>
      ) : null}
    </li>
  );
}

function CloseCount({ countId, counted, differences, review }: { countId: string; counted: number; differences: number; review: number }) {
  const blocked = review > 0 || counted === 0;
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card aria-label="Aplicar conteo">
        <h2 className="text-2xl font-black text-white">Aplicar conteo</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{differences === 0 ? "No hay diferencias: aplicar solo cierra el conteo." : `Se registra un ajuste por cada uno de los ${differences} repuestos con diferencia.`} Los repuestos sin contar no se tocan.</p>
        {review ? <p className="mt-2 text-sm text-red-300">Resolvé los {review} repuestos para revisar antes de aplicar.</p> : null}
        <form action={applyStockCountAction} className="mt-5 grid gap-4 [&_textarea]:w-full">
          <input name="countId" type="hidden" value={countId} />
          <Field label="Motivo del ajuste" htmlFor="apply-reason"><Textarea id="apply-reason" name="reason" placeholder="Ej. Conteo mensual del depósito" required /></Field>
          <SubmitButton disabled={blocked} label="Aplicar ajustes" pendingLabel="Aplicando…" />
        </form>
      </Card>
      <Card aria-label="Cancelar conteo">
        <h2 className="text-xl font-black text-white">Cancelar</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Descarta lo contado. El stock no cambia.</p>
        <form action={cancelStockCountAction} className="mt-5 grid gap-4 [&_input]:w-full">
          <input name="countId" type="hidden" value={countId} />
          <Field label="Motivo" htmlFor="cancel-reason"><TextInput id="cancel-reason" name="reason" required /></Field>
          <SubmitButton label="Cancelar conteo" pendingLabel="Cancelando…" variant="ghost" />
        </form>
      </Card>
    </section>
  );
}

function SubmitButton({ label, pendingLabel = "Guardando…", disabled = false, variant }: { label: string; pendingLabel?: string; disabled?: boolean; variant?: "ghost" }) {
  const { pending } = useFormStatus();
  return <Button className="justify-self-start" disabled={disabled || pending} type="submit" variant={variant}>{pending ? pendingLabel : label}</Button>;
}

function StatusChip({ status }: { status: CountStatus }) {
  const styles = { OPEN: "bg-apple-400/15 text-apple-300", APPLIED: "bg-white/10 text-zinc-300", CANCELLED: "bg-zinc-800 text-zinc-500" }[status];
  return <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${styles}`}>{{ OPEN: "Abierto", APPLIED: "Aplicado", CANCELLED: "Cancelado" }[status]}</span>;
}

function formatDate(value: Date) { return formatWorkshopDateTime(value, { dateStyle: "medium", timeStyle: "short" }); }
function number(value: number) { return new Intl.NumberFormat("es-AR").format(value); }
