import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getMercadoPagoEnv } from "@/src/lib/env";
import { MercadoPagoAdapter, validateMercadoPagoSignature } from "@/src/modules/payments/mercado-pago-adapter";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { processMercadoPagoPayment } from "@/src/modules/payments/service";

export async function POST(request: Request) {
  const env = getMercadoPagoEnv();
  if (!env) return NextResponse.json({ received: false }, { status: 503 });

  const url = new URL(request.url);
  const body = await request.json().catch(() => null) as {
    type?: string;
    data?: { id?: string | number };
  } | null;
  const dataId = url.searchParams.get("data.id") ?? (body?.data?.id === undefined ? null : String(body.data.id));
  const signatureValid = validateMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret: env.MERCADO_PAGO_WEBHOOK_SECRET,
  });
  if (!signatureValid) return NextResponse.json({ received: false }, { status: 401 });
  if (body?.type !== "payment" || !dataId) return NextResponse.json({ received: true });

  await processMercadoPagoPayment(
    new PrismaDepositPaymentRepository(db),
    new MercadoPagoAdapter(env),
    { paymentId: dataId, expectedLiveMode: env.MERCADO_PAGO_ENVIRONMENT === "production" },
  );
  return NextResponse.json({ received: true });
}
