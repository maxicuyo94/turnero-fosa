"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Card, EmptyState, Field, PageHeading, Select, TextInput, Textarea } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { publishProductAction, saveShopSettingsAction, updateShopOrderAction } from "@/app/(internal)/internal/shop/store-actions";
import { ShopShell } from "./shop-shell";
import { deliveryAreaNotice, deliveryPostalCode } from "./shipping-policy";
import { money, orderStatusLabels, type ShopActionResult } from "./storefront-schemas";
import type { PublicShopConfig } from "./storefront-screen";
import type { internalOrders } from "./storefront-queries";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";

function Feedback({ state }: { state: ShopActionResult }) { return state.error ? <Alert className="mt-4" tone="danger">{state.error}</Alert> : state.success ? <Alert className="mt-4" tone="success">{state.success}</Alert> : null; }

export function ShopPublicationForm({ id, version, isPublished }: { id: string; version: number; isPublished: boolean }) {
  const [state, action] = useActionState(publishProductAction, {});
  return <Card className="mt-6"><h2 className="font-bold text-white">Tienda online</h2><p className="mt-2 text-sm text-zinc-400">Publicá este repuesto para que puedan comprarlo mecánicos y particulares. También debe estar activo para aparecer en el catálogo.</p><form action={action} className="mt-4 flex flex-wrap items-center gap-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} /><label className="flex min-h-11 items-center gap-3 text-sm text-white"><input key={`${isPublished}-${version}`} className="h-5 w-5 accent-lime-400" type="checkbox" name="isPublished" defaultChecked={isPublished} />Publicado en la tienda</label><SubmitButton variant="secondary">Guardar publicación</SubmitButton></form><Feedback state={state} /></Card>;
}

export function ShopSettingsScreen({ config, paymentAvailable, signedInUserName }: { config: PublicShopConfig; paymentAvailable: boolean; signedInUserName: string }) {
  const [state, action] = useActionState(saveShopSettingsAction, {});
  return <ShopShell active="store" canManageWorkshop signedInUserName={signedInUserName}>
    <PageHeading eyebrow="Repuestos · venta online" title="Configuración de tienda" description="Definí cuándo pueden comprar y cómo reciben los repuestos." action={<Link href="/shop" className="inline-flex min-h-11 items-center font-bold text-apple-300">Ver tienda →</Link>} />
    <Card className="mt-6 max-w-2xl"><Alert tone={paymentAvailable ? "success" : "info"}>{paymentAvailable ? "Mercado Pago tiene credenciales configuradas. Verificá una compra de prueba antes de abrir la tienda." : "Faltan credenciales de Mercado Pago en este entorno. Todavía no se pueden habilitar compras online."}</Alert>
      <form action={action} className="mt-6 grid gap-5">
        <label className="flex min-h-11 items-center gap-3 font-bold text-white"><input className="h-5 w-5 accent-lime-400" type="checkbox" name="checkoutEnabled" defaultChecked={config.checkoutEnabled} disabled={!paymentAvailable} />Habilitar compras online</label>
        <Field label="Dirección e instrucciones de retiro" htmlFor="store-pickup" hint="Dirección, horarios y cómo presentar el pedido."><Textarea name="pickupInstructions" maxLength={1000} defaultValue={config.pickupInstructions} /></Field>
        <label className="flex min-h-11 items-center gap-3 font-bold text-white"><input className="h-5 w-5 accent-lime-400" type="checkbox" name="shippingEnabled" defaultChecked={config.shippingEnabled} />Ofrecer envío a domicilio en Salta capital</label>
        <Field label="Costo fijo de envío en pesos" htmlFor="store-shipping-price" hint="Usá 0 si el envío es gratis en toda la cobertura."><TextInput name="shippingFeeArs" inputMode="decimal" required defaultValue={(config.shippingFeeCents / 100).toFixed(2)} /></Field>
        <Field label="Códigos postales con cobertura" htmlFor="store-postal-codes" hint={deliveryAreaNotice}><TextInput name="shippingPostalCodes" readOnly value={deliveryPostalCode} /></Field>
        <p className="text-sm leading-6 text-zinc-400">Los productos se publican desde su ficha de inventario. El envío se coordina manualmente con el transportista y se registra su seguimiento al despachar.</p>
        <SubmitButton pendingLabel="Guardando…">Guardar configuración</SubmitButton>
      </form><Feedback state={state} />
    </Card>
  </ShopShell>;
}

type Order = Awaited<ReturnType<typeof internalOrders>>[number];
export function ShopOrdersScreen({ orders, canManageWorkshop, signedInUserName }: { orders: Order[]; canManageWorkshop: boolean; signedInUserName: string }) {
  return <ShopShell active="orders" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}><PageHeading eyebrow="Repuestos · compras" title="Pedidos online" description="Verificá pagos, prepará retiros y registrá envíos. Se muestran los últimos 100 pedidos." />
    <div className="mt-6 space-y-5">{orders.length ? orders.map((order) => <OrderCard key={order.id} order={order} canManageWorkshop={canManageWorkshop} />) : <EmptyState>Todavía no hay pedidos online.</EmptyState>}</div>
  </ShopShell>;
}
function OrderCard({ order, canManageWorkshop }: { order: Order; canManageWorkshop: boolean }) {
  const [state, action] = useActionState(updateShopOrderAction, {});
  const actions = order.status === "AWAITING_PAYMENT" ? [{ value: "SYNC", label: "Verificar pago / vencimiento" }, { value: "CANCELLED", label: "Cancelar pedido sin pago" }]
    : order.status === "PAID" && order.deliveryKind === "PICKUP" ? [{ value: "READY", label: "Marcar listo para retirar" }, { value: "COMPLETED", label: "Confirmar retiro" }]
    : order.status === "READY" ? [{ value: "COMPLETED", label: "Confirmar retiro" }]
    : order.status === "PAID" && order.deliveryKind === "SHIPPING" ? [{ value: "SHIPPED", label: "Confirmar despacho" }]
    : order.status === "SHIPPED" ? [{ value: "COMPLETED", label: "Confirmar entrega" }]
    : order.status === "PAYMENT_REVIEW" && canManageWorkshop ? [{ value: "SYNC", label: "Verificar pago" }, { value: "CLOSE_REVIEW", label: "Cerrar tras devolución / contracargo" }] : [{ value: "SYNC", label: "Verificar pago" }];
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-white">{order.code}</h2><p className="mt-1 text-sm text-zinc-400">{formatWorkshopDateTime(order.createdAt, { dateStyle: "short", timeStyle: "short" })}</p></div><span className="text-sm font-bold text-apple-300">{orderStatusLabels[order.status]}</span></div>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><div className="min-w-0 text-sm leading-6 text-zinc-300"><p className="font-bold text-white">{order.fullName} · {order.buyerKind === "MECHANIC" ? "Mecánico" : "Particular"}</p>{order.workshopName ? <p>{order.workshopName}</p> : null}<p className="break-words">{order.email}</p><p>{order.phone}</p><p className="mt-3 font-bold text-white">{order.deliveryKind === "PICKUP" ? "Retiro en taller" : "Envío a domicilio"}</p>{order.deliveryKind === "SHIPPING" ? <p>{order.address}<br />{order.city}, {order.province} · CP {order.postalCode}</p> : null}{order.tracking ? <p className="mt-2 break-words">Seguimiento: {order.tracking}</p> : null}</div>
      <div><ul className="space-y-2 text-sm text-zinc-300">{order.items.map((i) => <li key={i.id}>{i.quantity} × {i.name} · {money(i.quantity * i.unitPriceCents)}</li>)}</ul><p className="mt-3 text-sm text-zinc-400">Envío: {money(order.shippingFeeCents)}</p><p className="mt-2 text-xl font-black text-white">Total {money(order.totalCents)}</p>{order.payments.map((p) => <p className="mt-2 break-all text-xs text-zinc-400" key={p.id}>Mercado Pago #{p.id}: {p.status}</p>)}</div>
    </div>
    {order.reviewReason ? <Alert className="mt-5">Revisión requerida: {order.reviewReason}. No entregar hasta resolver el pago. Las devoluciones se gestionan desde Mercado Pago.</Alert> : null}
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><input type="hidden" name="id" value={order.id} /><Field label="Acción" htmlFor={`order-action-${order.id}`}><Select name="target">{actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</Select></Field>{order.status === "PAID" && order.deliveryKind === "SHIPPING" ? <Field className="sm:col-span-2" label="Transportista y código de seguimiento" htmlFor={`order-tracking-${order.id}`}><TextInput name="tracking" required maxLength={250} /></Field> : null}<SubmitButton variant="secondary" className="sm:self-end" pendingLabel="Actualizando…">Aplicar</SubmitButton></form><Feedback state={state} />
    <details className="mt-5 text-sm text-zinc-400"><summary className="min-h-11 cursor-pointer py-3">Historial del pedido</summary><ol className="space-y-2">{order.events.map((event) => <li key={event.id}>{formatWorkshopDateTime(event.createdAt, { dateStyle: "short", timeStyle: "short" })} · {event.note}</li>)}</ol></details>
  </Card>;
}
