import { afterEach, describe, expect, it, vi } from "vitest";
import { getMercadoPagoEnv } from "@/src/lib/env";
import { MercadoPagoAdapter, expectedPaymentLiveMode } from "@/src/modules/payments/mercado-pago-adapter";

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

  it("opens the sandbox checkout only with an application's TEST- credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout", sandbox_init_point: "https://mp/sandbox" }))));
    const preference = {
      externalReference: "ref-1",
      title: "Seña",
      amountCents: 500_000,
      payerEmail: null,
      expiresAt: new Date("2026-09-28T12:30:00Z"),
    };
    const checkoutUrl = async (overrides: Record<string, string>) =>
      (await new MercadoPagoAdapter(getMercadoPagoEnv({ ...credentials, ...overrides })!).createPreference(preference)).checkoutUrl;

    expect(await checkoutUrl({ MERCADO_PAGO_ENVIRONMENT: "test" })).toBe("https://mp/sandbox");
    // A test seller's own credentials: the sandbox would see a test party next to a real one.
    expect(await checkoutUrl({ MERCADO_PAGO_ENVIRONMENT: "test", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-test-seller" })).toBe("https://mp/checkout");
    expect(await checkoutUrl({ MERCADO_PAGO_ENVIRONMENT: "production", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-real" })).toBe("https://mp/checkout");
  });

  it("expects sandbox payments only from TEST- credentials", () => {
    const liveMode = (overrides: Record<string, string>) => expectedPaymentLiveMode(getMercadoPagoEnv({ ...credentials, ...overrides })!);

    expect(liveMode({ MERCADO_PAGO_ENVIRONMENT: "test" })).toBe(false);
    // Test users paying a test seller through the regular checkout arrive with live_mode: true.
    expect(liveMode({ MERCADO_PAGO_ENVIRONMENT: "test", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-test-seller" })).toBe(true);
    expect(liveMode({ MERCADO_PAGO_ENVIRONMENT: "production", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-real" })).toBe(true);
  });
});
