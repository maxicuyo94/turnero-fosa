// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSensitive, encryptSensitive } from "@/src/lib/data-encryption";
import { verifyBotProtection } from "@/src/lib/bot-protection";
import { contentSecurityPolicy } from "@/src/lib/security-headers";
import { safeErrorDetails } from "@/src/lib/safe-logging";
import { verifyPassword } from "@/src/lib/password";
import { checkoutSchema } from "@/src/modules/shop/storefront-schemas";
import { emailOutboxEntry, PrismaEmailDeliveryRepository } from "@/src/modules/notifications/prisma-repository";
import { encryptOrderContact, decryptOrderContact } from "@/src/modules/shop/order-privacy";
import type { PrismaClient } from "@prisma/client";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const env = { NODE_ENV: "production" as const, DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex") };

describe("sensitive data", () => {
  it("encrypts with a unique nonce and authenticates both ciphertext and field purpose", () => {
    const first = encryptSensitive("private cancellation link", "email-body", env);
    const second = encryptSensitive("private cancellation link", "email-body", env);
    expect(first).not.toBe(second);
    expect(first).not.toContain("private");
    expect(decryptSensitive(first, "email-body", env)).toBe("private cancellation link");
    expect(() => decryptSensitive(first, "shop-email", env)).toThrow();
    expect(() => decryptSensitive(first, "email-body", { ...env, DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex") })).toThrow();
    const payload = Buffer.from(first.slice("enc:v1:".length), "base64url");
    payload[payload.length - 1] ^= 1;
    expect(() => decryptSensitive("enc:v1:" + payload.toString("base64url"), "email-body", env)).toThrow();
  });

  it("refuses plaintext writes in production without a valid key and allows legacy reads", () => {
    expect(() => encryptSensitive("private", "email-body", { NODE_ENV: "production" })).toThrow();
    expect(() => encryptSensitive("private", "email-body", { ...env, DATA_ENCRYPTION_KEY: "invalid" })).toThrow();
    expect(decryptSensitive("old row", "email-body", env)).toBe("old row");
  });

  it("stores an encrypted outbox and only decrypts it at delivery", async () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", env.DATA_ENCRYPTION_KEY);
    const draft = { event: "PUBLIC_BOOKING_CREATED" as const, recipient: "customer@example.com", subject: "Private", text: "secret cancellation link" };
    const stored = emailOutboxEntry(draft);
    expect(stored.recipient).not.toContain(draft.recipient);
    expect(stored.body).not.toContain(draft.text);
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ ...stored, id: "1", appointmentId: null, attempts: 1, createdAt: new Date() }]) } as unknown as PrismaClient;
    const claimed = await new PrismaEmailDeliveryRepository(prisma).claimDueEmails({ now: new Date(), leaseUntil: new Date(), limit: 1 });
    expect(claimed[0]).toMatchObject({ recipient: draft.recipient, subject: draft.subject, text: draft.text });
  });

  it("encrypts order contact fields and preserves operational fields", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", env.DATA_ENCRYPTION_KEY);
    const contact = { fullName: "Customer", email: "customer@example.com", phone: "1155555555", workshopName: null, address: "Private address", city: "City", province: "Province", postalCode: "1234", status: "PAID" };
    const stored = encryptOrderContact(contact);
    expect(stored.address).not.toContain(contact.address);
    expect(stored.email).not.toContain(contact.email);
    expect(stored.status).toBe("PAID");
    expect(decryptOrderContact(stored)).toEqual(contact);
  });
});

describe("bot verification", () => {
  const botEnv = { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "server-secret", NEXT_PUBLIC_APP_URL: "https://taller.example.com" };
  const form = () => { const result = new FormData(); result.set("cf-turnstile-response", "token"); return result; };
  it("fails closed in production, rejects the trap and never calls the provider for absent tokens", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await verifyBotProtection(form(), "booking", {})).toBe(true);
    expect(await verifyBotProtection(form(), "booking", { NODE_ENV: "production" })).toBe(false);
    expect(await verifyBotProtection(new FormData(), "booking", botEnv)).toBe(false);
    const trap = form(); trap.set("website", "spam");
    expect(await verifyBotProtection(trap, "booking", botEnv)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires the provider's success, hostname and matching action", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    for (const result of [{ success: false }, { success: true, hostname: "evil.example.com", action: "booking" }, { success: true, hostname: "taller.example.com", action: "shop" }]) {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => result });
      expect(await verifyBotProtection(form(), "booking", botEnv)).toBe(false);
    }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, hostname: "taller.example.com", action: "booking" }) });
    expect(await verifyBotProtection(form(), "booking", botEnv)).toBe(true);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await verifyBotProtection(form(), "booking", botEnv)).toBe(false);
  });
});

describe("request boundaries", () => {
  it("rejects hidden state, role and price fields in checkout schemas", () => {
    const input = { requestKey: crypto.randomUUID(), accessToken: "a".repeat(64), buyerKind: "INDIVIDUAL", fullName: "Buyer", email: "buyer@example.com", phone: "1155555555", deliveryKind: "PICKUP", items: [{ productId: "1", quantity: 1, unitPriceCents: 100 }], shippingFeeCents: 0 };
    expect(checkoutSchema.safeParse(input).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...input, status: "PAID", role: "ADMIN", totalCents: 1 }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, items: [{ ...input.items[0], reservedStock: 0 }] }).success).toBe(false);
  });
  it("never logs error messages, payloads or credentials", () => {
    expect(safeErrorDetails(Object.assign(new Error("password=secret"), { code: "P2002", data: "secret" }))).toEqual({ category: "Error", code: "P2002" });
    expect(JSON.stringify(safeErrorDetails({ code: "secret", message: "secret" }))).not.toContain("secret");
  });
  it("enforces a nonce and disallows unsafe evaluation in the production CSP", () => {
    const csp = contentSecurityPolicy("test-nonce", true);
    expect(csp).toContain("'nonce-test-nonce'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("rejects malformed password hashes and excessive passwords without expensive work", async () => {
    for (const hash of ["scrypt:salt:", "scrypt:salt:ff", "scrypt:a:b", "other:a:b"]) expect(await verifyPassword("password", hash)).toBe(false);
    expect(await verifyPassword("a".repeat(129), "scrypt:" + "a".repeat(32) + ":" + "a".repeat(128))).toBe(false);
  });
});
