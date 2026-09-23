import { afterEach, describe, expect, it, vi } from "vitest";
import { getMercadoPagoEnv } from "@/src/lib/env";
import { MercadoPagoAdapter } from "@/src/modules/payments/mercado-pago-adapter";

const credentials = {
  MERCADO_PAGO_ACCESS_TOKEN: "TEST-token",
  MERCADO_PAGO_WEBHOOK_SECRET: "webhook-secret",
  NEXT_PUBLIC_APP_URL: "https://turnero-fosa.vercel.app",
};

describe("Mercado Pago return and notification URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the configured origin outside Vercel previews", () => {
    const env = getMercadoPagoEnv({ ...credentials, VERCEL_ENV: "production", VERCEL_BRANCH_URL: "turnero-fosa-git-main.vercel.app" });

    expect(env).toMatchObject({ NEXT_PUBLIC_APP_URL: "https://turnero-fosa.vercel.app" });
    expect(env).not.toHaveProperty("VERCEL_PROTECTION_BYPASS");
  });

  it("keeps a preview on its own branch URL and lets Mercado Pago past the protection", () => {
    const env = getMercadoPagoEnv({
      ...credentials,
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "turnero-fosa-git-preview-team.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
    });

    expect(env).toMatchObject({
      NEXT_PUBLIC_APP_URL: "https://turnero-fosa-git-preview-team.vercel.app",
      VERCEL_PROTECTION_BYPASS: "bypass-secret",
    });
  });

  it("names this deployment in every preference it creates", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout", sandbox_init_point: "https://mp/sandbox" })));
    vi.stubGlobal("fetch", fetchMock);
    const env = getMercadoPagoEnv({
      ...credentials,
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "turnero-fosa-git-preview-team.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
    })!;

    await new MercadoPagoAdapter(env).createPreference({
      externalReference: "ref 1",
      title: "Seña",
      amountCents: 500_000,
      payerEmail: null,
      expiresAt: new Date("2026-09-28T12:30:00Z"),
    });

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.notification_url).toBe(
      "https://turnero-fosa-git-preview-team.vercel.app/api/mercado-pago/webhook?source_news=webhooks&x-vercel-protection-bypass=bypass-secret",
    );
    expect(body.back_urls.success).toBe("https://turnero-fosa-git-preview-team.vercel.app/booking/payment?reference=ref+1");
  });

  it("names the customer as payer only with production credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout" })));
    vi.stubGlobal("fetch", fetchMock);
    const preference = {
      externalReference: "ref-1",
      title: "Seña",
      amountCents: 500_000,
      payerEmail: "cliente@example.com",
      expiresAt: new Date("2026-09-28T12:30:00Z"),
    };
    const sentPayer = (call: number) =>
      JSON.parse((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string).payer;

    await new MercadoPagoAdapter(getMercadoPagoEnv({ ...credentials, MERCADO_PAGO_ENVIRONMENT: "test" })!).createPreference(preference);
    await new MercadoPagoAdapter(getMercadoPagoEnv({ ...credentials, MERCADO_PAGO_ENVIRONMENT: "production" })!).createPreference(preference);

    // A real email next to a test seller makes the sandbox refuse the checkout.
    expect(sentPayer(0)).toBeUndefined();
    expect(sentPayer(1)).toEqual({ email: "cliente@example.com" });
  });
});
