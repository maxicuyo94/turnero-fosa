import { createHmac, timingSafeEqual } from "node:crypto";
import type { MercadoPagoEnv } from "@/src/lib/env";
import type { MercadoPagoPort } from "@/src/modules/payments/service";

const apiBaseUrl = "https://api.mercadopago.com";

export class MercadoPagoAdapter implements MercadoPagoPort {
  constructor(private readonly env: MercadoPagoEnv) {}

  async createPreference(input: Parameters<MercadoPagoPort["createPreference"]>[0]) {
    const response = await this.request<{
      id: string;
      init_point: string;
      sandbox_init_point?: string;
    }>("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{
          id: input.externalReference,
          title: input.title,
          quantity: 1,
          currency_id: "ARS",
          unit_price: input.amountCents / 100,
        }],
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        external_reference: input.externalReference,
        notification_url: `${this.env.NEXT_PUBLIC_APP_URL}/api/mercado-pago/webhook?source_news=webhooks`,
        back_urls: {
          success: `${this.env.NEXT_PUBLIC_APP_URL}/booking/payment?reference=${encodeURIComponent(input.externalReference)}`,
          pending: `${this.env.NEXT_PUBLIC_APP_URL}/booking/payment?reference=${encodeURIComponent(input.externalReference)}`,
          failure: `${this.env.NEXT_PUBLIC_APP_URL}/booking/payment?reference=${encodeURIComponent(input.externalReference)}`,
        },
        auto_return: "approved",
        expires: true,
        expiration_date_to: input.expiresAt.toISOString(),
      }),
    });

    const checkoutUrl = this.env.MERCADO_PAGO_ENVIRONMENT === "test"
      ? response.sandbox_init_point ?? response.init_point
      : response.init_point;
    return { preferenceId: response.id, checkoutUrl };
  }

  async getPayment(paymentId: string) {
    const payment = await this.request<{
      id: number | string;
      external_reference?: string | null;
      transaction_amount: number;
      currency_id: string;
      status: string;
      status_detail?: string | null;
      live_mode: boolean;
      date_approved?: string | null;
    }>(`/v1/payments/${encodeURIComponent(paymentId)}`);
    return {
      id: String(payment.id),
      externalReference: payment.external_reference ?? null,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      status: payment.status,
      statusDetail: payment.status_detail ?? null,
      liveMode: payment.live_mode,
      approvedAt: payment.date_approved ? new Date(payment.date_approved) : null,
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Mercado Pago API returned ${response.status}.`);
    return response.json() as Promise<T>;
  }
}

export function validateMercadoPagoSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  nowSeconds?: number;
}): boolean {
  if (!input.xSignature || !input.xRequestId || !input.dataId) return false;
  const parts = new Map(input.xSignature.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  const timestampSeconds = Number(timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds > nowSeconds + 60 || nowSeconds - timestampSeconds > 300) return false;

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${timestamp};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}
