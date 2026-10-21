import { NextResponse } from "next/server";
import { paymentEnv, processShopPaymentNotification } from "@/src/lib/composition";
import { validateMercadoPagoSignature } from "@/src/modules/payments/mercado-pago-adapter";

export async function POST(request: Request) {
  const env = await paymentEnv().catch(() => null);
  if (!env) return NextResponse.json({ received: false }, { status: 503 });
  const url = new URL(request.url);
  const id = url.searchParams.get("data.id");
  if (!validateMercadoPagoSignature({ xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId: id, secret: env.MERCADO_PAGO_WEBHOOK_SECRET })) {
    return NextResponse.json({ received: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { type?: string } | null;
  if ((body?.type ?? url.searchParams.get("type")) === "payment" && id) await processShopPaymentNotification(env, id);
  return NextResponse.json({ received: true });
}
