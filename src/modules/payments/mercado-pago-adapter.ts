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
      // One external reference is one checkout: concurrent starts get the same preference back.
      headers: { "X-Idempotency-Key": input.externalReference },
      body: JSON.stringify({
        items: [{
          id: input.externalReference,
          title: input.title,
          quantity: 1,
          currency_id: "ARS",
          unit_price: input.amountCents / 100,
        }],
        payer: this.payer(input.payerEmail),
        external_reference: input.externalReference,
        notification_url: this.notificationUrl(),
        back_urls: {
          success: this.returnUrl(input.externalReference),
          pending: this.returnUrl(input.externalReference),
          failure: this.returnUrl(input.externalReference),
        },
        auto_return: "approved",
        expires: true,
        expiration_date_to: input.expiresAt.toISOString(),
        // The reservation lasts minutes. Cash vouchers and ATM payments stay payable for at least a
        // day, and pending card reviews settle later, so only instant approve-or-reject is offered.
        binary_mode: true,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
      }),
    });

    const checkoutUrl = this.usesSandboxCheckout()
      ? response.sandbox_init_point ?? response.init_point
      : response.init_point;
    return { preferenceId: response.id, checkoutUrl };
  }

  /**
   * Only an application's `TEST-` credentials belong to the sandbox checkout. A test seller's own
   * `APP_USR-` credentials — Mercado Pago's current way to test — create a preference that the
   * sandbox rejects as mixing a test party with a real one, so those open the regular checkout.
   */
  private usesSandboxCheckout(): boolean {
    return usesSandboxCredentials(this.env);
  }

  async getPayment(paymentId: string) {
    return mapPayment(await this.request<ProviderPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`));
  }

  async searchPayments(externalReference: string) {
    const query = new URLSearchParams({
      external_reference: externalReference,
      sort: "date_created",
      criteria: "desc",
    });
    const response = await this.request<{ results?: ProviderPayment[] }>(`/v1/payments/search?${query.toString()}`);
    return (response.results ?? []).map(mapPayment);
  }

  /**
   * Each preference names its own webhook, so every deployment receives the notifications of the
   * checkouts it created; the URL in the Mercado Pago panel is only a fallback. A protected preview
   * would answer Mercado Pago with Vercel's login page, so the automation bypass rides along.
   */
  private notificationUrl(): string {
    const url = new URL("/api/mercado-pago/webhook", this.env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("source_news", "webhooks");
    if (this.env.VERCEL_PROTECTION_BYPASS) url.searchParams.set("x-vercel-protection-bypass", this.env.VERCEL_PROTECTION_BYPASS);
    return url.toString();
  }

  /**
   * With test credentials the seller is a test account, and Mercado Pago refuses a checkout that
   * mixes it with a real party ("una de las partes … es de prueba"). The customer's email is real,
   * so in test mode it stays out and the logged-in test buyer pays.
   */
  private payer(email: string | null): { email: string } | undefined {
    return email && this.env.MERCADO_PAGO_ENVIRONMENT === "production" ? { email } : undefined;
  }

  private returnUrl(externalReference: string): string {
    const url = new URL("/booking/payment", this.env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("reference", externalReference);
    return url.toString();
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

type ProviderPayment = {
  id: number | string;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id: string;
  status: string;
  status_detail?: string | null;
  live_mode: boolean;
  date_approved?: string | null;
};

function mapPayment(payment: ProviderPayment) {
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

/** Only an application's `TEST-` credentials run in the sandbox. */
function usesSandboxCredentials(env: MercadoPagoEnv): boolean {
  return env.MERCADO_PAGO_ENVIRONMENT === "test" && env.MERCADO_PAGO_ACCESS_TOKEN.startsWith("TEST-");
}

/**
 * The `live_mode` a genuine payment for these credentials carries. Payments between test users made
 * with a test seller's `APP_USR-` credentials go through the regular checkout and arrive as live,
 * so only the sandbox expects `false`.
 */
export function expectedPaymentLiveMode(env: MercadoPagoEnv): boolean {
  return !usesSandboxCredentials(env);
}

/** Timestamps above this are milliseconds; below, seconds (both appear in Mercado Pago's docs). */
const MILLISECOND_TIMESTAMP_THRESHOLD = 1e11;

/**
 * Validates `x-signature` as documented: `id:[data.id_url];request-id:[x-request-id];ts:[ts];`,
 * where `data.id` comes from the URL query, is lowercased, and any missing value is left out.
 */
export function validateMercadoPagoSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  nowSeconds?: number;
}): boolean {
  if (!input.xSignature) return false;
  const parts = new Map(input.xSignature.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  const rawTimestamp = Number(timestamp);
  const timestampSeconds = rawTimestamp > MILLISECOND_TIMESTAMP_THRESHOLD ? rawTimestamp / 1_000 : rawTimestamp;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds > nowSeconds + 60 || nowSeconds - timestampSeconds > 300) return false;

  const manifest = [
    input.dataId ? `id:${input.dataId.toLowerCase()};` : "",
    input.xRequestId ? `request-id:${input.xRequestId};` : "",
    `ts:${timestamp};`,
  ].join("");
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}
