"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { payShopOrderAction, refreshShopOrderAction } from "@/app/shop/actions";
import { saveCart, useCart, type CartItem } from "./cart-storage";

export function OrderPaymentControls({ token, canPay, rebuildItems }: { token: string; canPay: boolean; rebuildItems?: CartItem[] }) {
  const [payState, pay, paying] = useActionState(payShopOrderAction, {});
  const [refreshState, refresh, checking] = useActionState(refreshShopOrderAction, {});
  const [copyNotice, setCopyNotice] = useState("");
  const router = useRouter();
  const cart = useCart();
  useEffect(() => {
    if (!canPay) return;
    let count = 0;
    const timer = window.setInterval(() => {
      if (count >= 3) { window.clearInterval(timer); return; }
      count++;
      const form = new FormData(); form.set("token", token);
      startTransition(() => refresh(form));
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [canPay, token, refresh]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/shop/order?token=${token}`); setCopyNotice("Enlace copiado. Guardalo para consultar tu compra."); }
    catch { setCopyNotice("No pudimos copiarlo. Guardá la dirección de esta página en tus favoritos."); }
  }
  return <div className="mt-6 space-y-4">
    {canPay ? <><p className="text-sm leading-6 text-text-secondary">Si ya pagaste, estamos comprobando la acreditación. No vuelvas a pagar mientras esperás la confirmación.</p><form action={pay}><input type="hidden" name="token" value={token} /><SubmitButton disabled={checking} pendingLabel="Abriendo Mercado Pago…">Pagar con Mercado Pago</SubmitButton>{payState.error ? <Alert className="mt-3" tone="danger">{payState.error}</Alert> : null}</form></> : null}
    <form action={refresh}><input type="hidden" name="token" value={token} /><SubmitButton disabled={paying || checking} variant="secondary" pendingLabel="Consultando…">{checking ? "Consultando…" : "Actualizar estado del pago"}</SubmitButton>{refreshState.error ? <Alert className="mt-3" tone="danger">{refreshState.error}</Alert> : refreshState.success ? <Alert className="mt-3" tone="success">{refreshState.success}</Alert> : null}</form>
    <Button variant="secondary" onClick={copyLink}>Copiar enlace de mi pedido</Button><p role="status" className="text-sm text-text-secondary">{copyNotice}</p>
    {rebuildItems ? <div><p className="mb-3 text-sm leading-6 text-text-muted">Podés volver a armar la compra. Revisaremos los precios y el stock actuales antes de crear otro pedido.</p><Button onClick={() => { saveCart([...cart, ...rebuildItems.filter((item) => !cart.some((row) => row.productId === item.productId))].slice(0,50)); router.push("/shop/checkout"); }}>Volver a armar este pedido</Button></div> : null}
  </div>;
}
