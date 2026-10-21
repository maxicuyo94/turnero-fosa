"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Field, PageHeading, PageShell, Select, SiteHeader, TextInput } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { BotProtection } from "@/src/components/bot-protection";
import { createShopOrderAction } from "@/app/shop/actions";
import { saveCart, useCart, type CartItem } from "./cart-storage";
import { rememberOrder, useCheckoutDraft, type CheckoutDraft } from "./shop-customer-state";
import { BackToCatalog, LastOrderLink, shopLinkClass } from "./storefront-components";
import { money, type ShopActionResult } from "./storefront-schemas";
import { deliveryAreaLabel, deliveryAreaNotice, deliveryCity, deliveryProvince, deliveryPostalCode } from "./shipping-policy";
import type { PublicProduct, PublicShopConfig } from "./storefront-screen";

function QuantityControl({ item, available, name }: { item: CartItem; available: number; name: string }) {
  const cart = useCart();
  const [editing, setEditing] = useState<string | null>(null);
  const limit = Math.min(available, 100);
  function change(value: number) {
    if (Number.isInteger(value) && value > 0 && value <= limit) {
      saveCart(cart.map((row) => row.productId === item.productId ? { ...row, quantity: value } : row));
      setEditing(null);
    }
  }
  const invalid = editing !== null && (!/^\d+$/u.test(editing) || Number(editing) < 1 || Number(editing) > limit);
  return <div><div className="flex items-center gap-2"><Button variant="secondary" aria-label={`Quitar una unidad de ${name}`} disabled={item.quantity <= 1} onClick={() => change(item.quantity - 1)}>−</Button><TextInput className="w-20 text-center" aria-label={`Cantidad de ${name}`} inputMode="numeric" required pattern={Array.from({ length: limit }, (_, index) => index + 1).join("|")} value={editing ?? String(item.quantity)} onChange={(e) => setEditing(e.target.value)} onBlur={() => { if (editing !== null && !invalid) change(Number(editing)); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (editing !== null && !invalid) change(Number(editing)); } }} aria-invalid={invalid || undefined} /><Button variant="secondary" aria-label={`Agregar una unidad de ${name}`} disabled={item.quantity >= limit} onClick={() => change(item.quantity + 1)}>+</Button></div>{invalid ? <p role="alert" className="mt-2 text-sm text-danger">Ingresá entre 1 y {limit} unidades.</p> : null}</div>;
}

export function ShopCheckoutScreen({ products, config, paymentAvailable }: { products: PublicProduct[]; config: PublicShopConfig; paymentAvailable: boolean }) {
  const cart = useCart();
  const [draft, updateDraft] = useCheckoutDraft();
  const [stage, setStage] = useState<"cart" | "details" | "review">("cart");
  const heading = useRef<HTMLHeadingElement>(null);
  const errorNotice = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: ShopActionResult, form: FormData) => {
    try {
      // Verification tokens change independently of the buyer's purchase intent.
      const signature = JSON.stringify(Object.fromEntries([...form.entries()].filter(([name]) => !["cf-turnstile-response", "website"].includes(name))));
      const raw = sessionStorage.getItem("shop-attempt");
      const saved = raw ? JSON.parse(raw) as { signature: string; requestKey: string; accessToken: string } : null;
      const attempt = saved?.signature === signature ? saved : { signature, requestKey: crypto.randomUUID(), accessToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join("") };
      sessionStorage.setItem("shop-attempt", JSON.stringify(attempt));
      form.set("requestKey", attempt.requestKey); form.set("accessToken", attempt.accessToken);
      return await createShopOrderAction(previous, form);
    } catch { return { error: "No pudimos preparar la compra. Comprobá tu conexión y que el navegador permita guardar datos, y volvé a intentar." }; }
  }, {});
  useEffect(() => {
    if (state.orderUrl) { rememberOrder(state.orderUrl); saveCart([]); router.push(state.orderUrl); }
  }, [state.orderUrl, router]);
  useEffect(() => {
    if (state.error) { errorNotice.current?.focus(); errorNotice.current?.scrollIntoView({ block: "center", behavior: "instant" }); }
  }, [state]);
  const rows = cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.productId) }));
  const stale = rows.some((item) => !item.product || item.product.priceCents !== item.unitPriceCents || item.quantity > item.product.available);
  const subtotal = rows.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const delivery = config.shippingEnabled ? draft.deliveryKind : "PICKUP";
  const covered = delivery === "PICKUP" || draft.postalCode === deliveryPostalCode && config.shippingPostalCodes.includes(draft.postalCode);
  const shipping = delivery === "SHIPPING" ? config.shippingFeeCents : 0;
  const canBuy = config.checkoutEnabled && paymentAvailable;
  function nextStage(value: "cart" | "details" | "review") { if (pending) return; setStage(value); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }); }
  function input(name: keyof CheckoutDraft, label: string, maxLength: number, autoComplete: string, type = "text", required = true) {
    return <Field label={label} htmlFor={`checkout-${name}`} hint={required ? undefined : "Opcional"}><TextInput name={name} value={draft[name]} onChange={(e) => updateDraft({ [name]: e.target.value })} maxLength={maxLength} autoComplete={autoComplete} type={type} required={required} /></Field>;
  }
  return <><SiteHeader active="shop" linkComponent={Link} /><PageShell compact className="pb-44 lg:pb-10">
    <BackToCatalog>← Seguir buscando repuestos</BackToCatalog>
    <PageHeading className="[&_h1]:text-3xl sm:[&_h1]:text-5xl" eyebrow="Tu compra" title="Finalizá tu compra" description="Sin crear una cuenta. Elegí la entrega y revisá el total antes de confirmar." />
    <LastOrderLink />
    {!cart.length ? <Card className="mt-7"><p className="text-text-secondary">Tu carrito está vacío.</p><Link href="/shop" className={`${shopLinkClass} mt-4 bg-action text-action-text`}>Explorar repuestos</Link></Card> : <>
      <ol aria-label="Pasos de la compra" className="my-6 grid grid-cols-3 gap-2 text-xs sm:text-sm">{([ ["cart", "1. Carrito"], ["details", "2. Entrega y datos"], ["review", "3. Revisar y pagar"] ] as const).map(([step, label]) => <li key={step} aria-current={stage === step ? "step" : undefined}>{step !== stage && (step === "cart" || (step === "details" && stage === "review")) ? <Button variant="ghost" className="min-h-12 w-full px-2 text-xs sm:text-sm" disabled={pending} onClick={() => nextStage(step)}>{label}</Button> : <span className={`flex min-h-12 items-center justify-center rounded-control border px-2 text-center ${stage === step ? "border-action bg-action/10 font-bold text-action" : "border-border-subtle text-text-muted"}`}>{label}</span>}</li>)}</ol>
      <h2 ref={heading} tabIndex={-1} className="mb-5 scroll-mt-5 text-2xl font-black text-text-primary outline-none">{stage === "cart" ? "Tu carrito" : stage === "details" ? "Elegí la entrega y completá tus datos" : "Confirmá los datos de tu compra"}</h2>
      <form action={action} onSubmit={(event) => { if (stage !== "review") { event.preventDefault(); if (!stale && (stage === "cart" || covered) && event.currentTarget.reportValidity()) nextStage(stage === "cart" ? "details" : "review"); } }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <input type="hidden" name="items" value={JSON.stringify(cart)} /><input type="hidden" name="shippingFeeCents" value={shipping} />
        <div className="min-w-0 space-y-6">
          {stage !== "details" ? <Card><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold text-text-primary">Repuestos</h3>{stage === "review" ? <Button variant="ghost" disabled={pending} onClick={() => nextStage("cart")}>Editar carrito</Button> : null}</div><ul className="mt-3 divide-y divide-border-subtle">{rows.map((item) => {
            const p = item.product;
            const error = !p || !p.available ? "Este repuesto ya no está disponible. Quitalo para continuar." : item.quantity > p.available ? `Hay ${p.available} unidades disponibles. Ajustá la cantidad.` : p.priceCents !== item.unitPriceCents ? `El precio actual es ${money(p.priceCents)} por unidad.` : null;
            return <li className="py-4" key={item.productId}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-text-primary">{p?.name ?? "Repuesto no disponible"}</p><p className="mt-1 text-sm text-text-muted">{money(item.unitPriceCents)} por unidad</p></div><p className="font-bold text-text-primary">{money(item.quantity * item.unitPriceCents)}</p></div>{stage === "cart" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><QuantityControl item={item} available={p?.available ?? 0} name={p?.name ?? "repuesto"} /><Button variant="ghost" onClick={() => saveCart(cart.filter((row) => row.productId !== item.productId))} aria-label={`Quitar ${p?.name ?? "repuesto"} del carrito`}>Quitar</Button></div> : <p className="mt-2 text-sm text-text-secondary">Cantidad: {item.quantity}</p>}{error ? <Alert className="mt-3" tone="danger">{error}</Alert> : null}</li>;
          })}</ul>{stale ? <Button variant="secondary" className="mt-3" onClick={() => { saveCart(rows.flatMap((item) => item.product?.available ? [{ productId: item.productId, unitPriceCents: item.product.priceCents, quantity: Math.min(item.quantity, item.product.available) }] : [])); nextStage("cart"); }}>Actualizar precios y cantidades</Button> : null}</Card> : null}
          {stage !== "cart" ? <div hidden={stage !== "details"} className="space-y-6">
            <Card><h3 className="mb-5 text-lg font-bold text-text-primary">¿Cómo lo recibís?</h3><Field label="Cómo lo recibís" htmlFor="checkout-delivery"><Select name="deliveryKind" value={delivery} onChange={(e) => updateDraft({ deliveryKind: e.target.value as CheckoutDraft["deliveryKind"] })}><option value="PICKUP">Retiro en el taller · sin costo</option>{config.shippingEnabled ? <option value="SHIPPING">Envío en Salta · {money(config.shippingFeeCents)}</option> : null}</Select></Field>
              {config.shippingEnabled ? <p className="mt-3 text-sm leading-6 text-text-secondary">{deliveryAreaNotice} Para otras localidades, podés elegir retiro en el taller.</p> : null}
              {delivery === "SHIPPING" ? <div className="mt-5 grid gap-4"><Field label="Código postal" htmlFor="checkout-postalCode" error={draft.postalCode.length === 4 && !covered ? "Todavía no enviamos a ese código postal. Por ahora, solo Salta capital (CP 4400). Podés elegir retiro en el taller." : undefined} description={covered ? "Tenemos cobertura en Salta capital." : "Ingresá el código postal de tu domicilio en Salta capital (4400)."}><TextInput name="postalCode" required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" autoComplete="postal-code" value={draft.postalCode} onChange={(e) => updateDraft({ postalCode: e.target.value.replace(/\D/gu, "").slice(0,4) })} /></Field>{covered ? <><p className="text-sm text-text-secondary">Costo de envío: {money(shipping)}. El taller coordina el despacho después de acreditar el pago.</p>{input("address", "Dirección, altura y departamento", 250, "street-address")}<div className="grid gap-4 sm:grid-cols-2"><Field label="Localidad" htmlFor="checkout-city"><TextInput name="city" value={deliveryCity} readOnly autoComplete="address-level2" /></Field><Field label="Provincia" htmlFor="checkout-province"><TextInput name="province" value={deliveryProvince} readOnly autoComplete="address-level1" /></Field></div></> : null}</div> : <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{config.pickupInstructions}</p>}
            </Card>
            {covered ? <Card><h3 className="mb-5 text-lg font-bold text-text-primary">Datos de contacto</h3><div className="grid gap-4"><Field label="Comprás como" htmlFor="checkout-buyer"><Select name="buyerKind" value={draft.buyerKind} onChange={(e) => updateDraft({ buyerKind: e.target.value as CheckoutDraft["buyerKind"] })}><option value="INDIVIDUAL">Particular</option><option value="MECHANIC">Mecánico</option></Select></Field>{draft.buyerKind === "MECHANIC" ? input("workshopName", "Nombre del taller", 120, "organization", "text", false) : null}{input("fullName", "Nombre y apellido", 120, "name")}{input("email", "Email", 254, "email", "email")}{input("phone", "Teléfono", 40, "tel", "tel")}<p className="text-sm leading-6 text-text-muted">Usaremos estos datos para coordinar tu compra. No necesitás registrarte.</p></div></Card> : null}
          </div> : null}
          {stage === "details" ? <Button variant="secondary" onClick={() => nextStage("cart")}>← Editar carrito</Button> : null}
          {stage === "review" ? <Card><h3 className="text-lg font-bold text-text-primary">Entrega y contacto</h3><p className="mt-4 font-bold text-text-primary">{delivery === "SHIPPING" ? `Envío en ${deliveryAreaLabel}` : "Retiro en el taller"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{delivery === "SHIPPING" ? `${draft.address}\n${deliveryCity}, ${deliveryProvince} · CP ${draft.postalCode}` : config.pickupInstructions}</p><p className="mt-4 text-text-primary">{draft.fullName}{draft.workshopName && draft.buyerKind === "MECHANIC" ? ` · ${draft.workshopName}` : ""}</p><p className="mt-1 break-words text-sm text-text-secondary">{draft.email} · {draft.phone}</p><Button className="mt-4" variant="secondary" disabled={pending} onClick={() => nextStage("details")}>Editar entrega y datos</Button></Card> : null}
        </div>
        <Card className="lg:sticky lg:top-6"><h3 className="text-lg font-bold text-text-primary">Resumen de compra</h3><dl className="mt-5 space-y-3 text-sm text-text-secondary"><div className="flex justify-between"><dt>Repuestos</dt><dd>{money(subtotal)}</dd></div><div className="flex justify-between"><dt>{stage === "cart" ? "Entrega" : delivery === "SHIPPING" ? "Envío" : "Retiro"}</dt><dd>{stage === "cart" ? "Se elige en el siguiente paso" : shipping ? money(shipping) : "Sin costo"}</dd></div><div className="flex justify-between border-t border-border-subtle pt-4 text-2xl font-black text-text-primary"><dt>{stage === "cart" ? "Subtotal" : "Total"}</dt><dd>{money(subtotal + (stage === "cart" ? 0 : shipping))}</dd></div></dl>
          {!canBuy ? <Alert className="mt-5">Podés revisar tu compra. El pago online todavía no está habilitado.</Alert> : null}
          {state.error ? <div ref={errorNotice} tabIndex={-1} className="mt-5 scroll-mb-44 rounded-control focus-visible:outline-2 focus-visible:outline-focus"><Alert tone="danger">{state.error}<Button className="mt-3" variant="secondary" disabled={pending} onClick={() => nextStage("details")}>Revisar datos</Button></Alert></div> : null}
          {stage === "review" ? <><div className="mt-5"><BotProtection action="shop" resetSignal={state} /></div><p className="mt-4 text-sm leading-6 text-text-muted">Al confirmar reservamos el stock por 30 minutos. En el siguiente paso pagás con Mercado Pago.</p></> : null}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface-page p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <p className="mb-2 flex items-center justify-between gap-2 text-sm font-bold text-text-primary lg:hidden"><span>{stage === "cart" ? "Subtotal" : "Total"}</span><span className="text-xl">{money(subtotal + (stage === "cart" ? 0 : shipping))}</span></p>
            {stage === "cart" ? <Button type="submit" className="w-full" disabled={stale}>Elegir entrega</Button> : stage === "details" ? <Button type="submit" className="w-full" disabled={stale || !covered}>Revisar pedido</Button> : <SubmitButton className="w-full" disabled={!canBuy || stale || !covered || Boolean(state.orderUrl)} pendingLabel="Preparando pedido…">Confirmar pedido y continuar</SubmitButton>}
          </div>
          <p className="mt-4 text-xs leading-5 text-text-muted">El pedido se confirma cuando verificamos el pago.</p>
        </Card>
      </form>
    </>}
  </PageShell></>;
}
