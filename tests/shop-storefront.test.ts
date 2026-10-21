import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoAdapter } from "@/src/modules/payments/mercado-pago-adapter";
import { cartSchema, checkoutSchema, shopSettingsSchema } from "@/src/modules/shop/storefront-schemas";

afterEach(() => vi.unstubAllGlobals());
describe("storefront validation and payment routing", () => {
  it("rejects duplicate cart products, fractional and unbounded quantities", () => {
    const item = { productId: "product", unitPriceCents: 100, quantity: 1 };
    expect(cartSchema.safeParse([item, item]).success).toBe(false);
    expect(cartSchema.safeParse([{ ...item, quantity: 1.5 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ ...item, quantity: 101 }]).success).toBe(false);
  });
  it("requires explicit delivery coverage and pickup instructions", () => {
    const settings = { checkoutEnabled: true, shippingEnabled: true, shippingFeeArs: "1500,50", shippingPostalCodes: "", pickupInstructions: "Taller" };
    expect(shopSettingsSchema.safeParse(settings).success).toBe(false);
    expect(shopSettingsSchema.safeParse({ ...settings, shippingPostalCodes: "1406, 1407", pickupInstructions: "" }).success).toBe(false);
    expect(shopSettingsSchema.parse({ ...settings, shippingPostalCodes: "4400,4400" })).toMatchObject({ shippingFeeArs: 150050, shippingPostalCodes: ["4400"] });
  });
  it("rejects destinations outside Salta even when they share the postal code", () => {
    const data = { requestKey:"11111111-1111-4111-8111-111111111111", accessToken:"a".repeat(64), buyerKind:"INDIVIDUAL", fullName:"Comprador", email:"buyer@test.invalid", phone:"1155555555", deliveryKind:"SHIPPING", address:"Calle de prueba 123", city:"Salta", province:"Salta", postalCode:"4400", shippingFeeCents:250000, items:[{productId:"p",quantity:1,unitPriceCents:650000}] };
    expect(checkoutSchema.safeParse(data).success).toBe(true);
    expect(checkoutSchema.safeParse({...data,city:"San Lorenzo"}).success).toBe(false);
    expect(checkoutSchema.safeParse({...data,province:"Buenos Aires"}).success).toBe(false);
    expect(checkoutSchema.safeParse({...data,postalCode:"1406"}).success).toBe(false);
    expect(checkoutSchema.safeParse({...data,deliveryKind:"PICKUP",city:"Otra ciudad",postalCode:"1406"}).success).toBe(true);
    expect(shopSettingsSchema.safeParse({ checkoutEnabled:false,shippingEnabled:true,shippingFeeArs:"2500",shippingPostalCodes:"1406",pickupInstructions:"Taller" }).success).toBe(false);
  });
  it("keeps order payments separate from appointment deposits and includes shipping in the amount", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "pref", init_point: "https://www.mercadopago.com.ar/pay" }) });
    vi.stubGlobal("fetch", fetcher);
    const provider = new MercadoPagoAdapter({ MERCADO_PAGO_ACCESS_TOKEN: "TEST-local", MERCADO_PAGO_WEBHOOK_SECRET: "test", MERCADO_PAGO_ENVIRONMENT: "test", NEXT_PUBLIC_APP_URL: "https://shop.example.com" },
      { notificationPath: "/api/shop/payments/webhook", returnUrl: "https://shop.example.com/shop/order?token=private" });
    await provider.createPreference({ externalReference: "shop:order", title: "Repuestos", amountCents: 200050, payerEmail: "buyer@test.invalid", expiresAt: new Date("2030-01-01") });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({ external_reference: "shop:order", items: [{ unit_price: 2000.5 }], back_urls: { success: "https://shop.example.com/shop/order?token=private" } });
    expect(body.notification_url).toContain("/api/shop/payments/webhook");
    expect(body.notification_url).not.toContain("/api/mercado-pago/webhook");
  });
  it("reads partial refunds from the provider to prevent delivery of an incompletely paid order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 123, external_reference: "shop:order", transaction_amount: 1250.5, transaction_amount_refunded: 100, currency_id: "ARS", status: "approved", live_mode: false }) }));
    const provider = new MercadoPagoAdapter({ MERCADO_PAGO_ACCESS_TOKEN: "TEST-local", MERCADO_PAGO_WEBHOOK_SECRET: "test", MERCADO_PAGO_ENVIRONMENT: "test", NEXT_PUBLIC_APP_URL: "https://shop.example.com" });
    expect(await provider.getPayment("123")).toMatchObject({ amount: 1250.5, refundedAmount: 100, status: "approved" });
  });
});
