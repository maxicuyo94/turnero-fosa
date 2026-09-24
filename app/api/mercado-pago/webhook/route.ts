import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getMercadoPagoEnv } from "@/src/lib/env";
import { MercadoPagoAdapter, expectedPaymentLiveMode, validateMercadoPagoSignature } from "@/src/modules/payments/mercado-pago-adapter";
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
  // Mercado Pago signs the id sent in the query string; the body copy is only a fallback to look the
  // payment up, which is safe because the payment itself is always re-read from the API.
  const signedDataId = url.searchParams.get("data.id");
  const dataId = signedDataId ?? (body?.data?.id === undefined ? null : String(body.data.id));
  const signatureValid = validateMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: signedDataId,
    secret: env.MERCADO_PAGO_WEBHOOK_SECRET,
  });
  if (!signatureValid) {
    // Enough to tell a wrong secret from a malformed request, without logging the secret itself.
    const xSignature = request.headers.get("x-signature");
    const ts = xSignature?.match(/ts=(\d+)/)?.[1];
    console.warn("mercado-pago webhook: invalid signature", {
      hasSignature: Boolean(xSignature),
      hasRequestId: Boolean(request.headers.get("x-request-id")),
      signedDataId,
      bodyDataId: body?.data?.id ?? null,
      queryKeys: [...url.searchParams.keys()],
      tsAgeSeconds: ts ? Math.round(Date.now() / 1_000 - (Number(ts) > 1e11 ? Number(ts) / 1_000 : Number(ts))) : null,
      secretLength: env.MERCADO_PAGO_WEBHOOK_SECRET.length,
      secretFingerprint: createHash("sha256").update(env.MERCADO_PAGO_WEBHOOK_SECRET).digest("hex").slice(0, 8),
    });
    return NextResponse.json({ received: false }, { status: 401 });
  }
  const type = body?.type ?? url.searchParams.get("type");
  if (type !== "payment" || !dataId) return NextResponse.json({ received: true });

  await processMercadoPagoPayment(
    new PrismaDepositPaymentRepository(db),
    new MercadoPagoAdapter(env),
    { paymentId: dataId, expectedLiveMode: expectedPaymentLiveMode(env) },
  );
  return NextResponse.json({ received: true });
}
