import Link from "next/link";
import { guardPublicAccess } from "@/src/lib/public-access";
import type { Metadata } from "next";
import { shop, workshopContactSettings } from "@/src/lib/composition";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";
import { Alert, Card, PageHeading, PageShell, SiteHeader } from "@/src/components/ui";
import { money, orderStatusLabels } from "@/src/modules/shop/storefront-schemas";
import { OrderPaymentControls } from "@/src/modules/shop/order-payment-controls";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";

export const metadata: Metadata = { title: "Tu pedido | Taller Express", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function OrderPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (token) await guardPublicAccess();
  const [order, config, contact] = await Promise.all([shop.publicOrder(token), shop.shopConfiguration(), workshopContactSettings()]);
  const canPay = Boolean(order && order.status === "AWAITING_PAYMENT" && order.expiresAt > new Date());
  return <><SiteHeader active="shop" linkComponent={Link} /><PageShell><PageHeading eyebrow="Tienda de repuestos" title={order ? `Pedido ${order.code}` : "Consultar pedido"} description="Conservá este enlace privado para consultar tu compra." />
    {!order ? <Alert className="mt-6">No encontramos el pedido. Abrí el enlace que recibiste al confirmar tu compra.</Alert> : <Card className="mt-7 max-w-2xl">
      <p className="text-xl font-bold text-apple-300">{orderStatusLabels[order.status]}</p>
      {order.status === "AWAITING_PAYMENT" ? <p className="mt-3 text-sm leading-6 text-zinc-300">{canPay ? `El stock queda reservado hasta ${formatWorkshopDateTime(order.expiresAt, { dateStyle: "short", timeStyle: "short" })}. El pedido se confirma cuando verificamos el pago.` : "Venció el plazo para pagar. Actualizá el estado para comprobar el pago y liberar la reserva si corresponde."}</p> : null}
      {order.status === "PAYMENT_REVIEW" ? <Alert className="mt-4">El taller necesita revisar tu pago antes de continuar con la entrega. Contactanos e indicá el código del pedido.</Alert> : null}
      <ul className="mt-6 divide-y divide-white/10">{order.items.map((i, index) => <li key={index} className="flex justify-between gap-4 py-3 text-sm text-zinc-300"><span>{i.quantity} × {i.name}</span><span className="shrink-0">{money(i.quantity * i.unitPriceCents)}</span></li>)}</ul>
      <p className="mt-4 text-sm text-zinc-400">Envío: {money(order.shippingFeeCents)}</p><p className="mt-2 text-2xl font-black text-white">Total: {money(order.totalCents)}</p>
      <h2 className="mt-7 font-bold text-white">{order.deliveryKind === "PICKUP" ? "Retiro en el taller" : "Envío a domicilio"}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{order.deliveryKind === "PICKUP" ? config.pickupInstructions : "El taller prepara y despacha el pedido después de acreditar el pago."}</p>
      {order.tracking ? <p className="mt-3 break-words text-sm text-apple-300">Seguimiento: {order.tracking}</p> : null}
      {order.status === "PAID" ? <Alert className="mt-4" tone="success">Recibimos tu pago. El taller prepara los repuestos y coordina la entrega.</Alert> : null}
      <OrderPaymentControls token={token} canPay={canPay} rebuildItems={["EXPIRED", "CANCELLED"].includes(order.status) ? order.items.map(({ productId, quantity, unitPriceCents }) => ({ productId, quantity, unitPriceCents })) : undefined} />
    </Card>}
    <Link href="/shop" className="mt-6 inline-flex min-h-11 items-center font-bold text-apple-300">Volver a la tienda →</Link>
  </PageShell><WorkshopContact settings={{ ...contact, depositRefundPolicy: null }} /></>;
}
