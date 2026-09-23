import { afterEach, describe, expect, it, vi } from "vitest";

const deliverOutboxEmails = vi.fn(async () => ({ sent: 3, retried: 1, failed: 0 }));
vi.mock("@/src/lib/composition", () => ({ deliverOutboxEmails }));

const { GET } = await import("@/app/api/cron/emails/route");

const request = (authorization?: string) =>
  new Request("https://turnos.example/api/cron/emails", { headers: authorization ? { authorization } : {} });

describe("email outbox cron endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    deliverOutboxEmails.mockClear();
  });

  it("stays closed until a secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer anything"))).status).toBe(503);
    expect(deliverOutboxEmails).not.toHaveBeenCalled();
  });

  it("rejects callers without the bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    expect((await GET(request("Bearer wrong-secret-value"))).status).toBe(401);
    expect(deliverOutboxEmails).not.toHaveBeenCalled();
  });

  it("delivers the due emails for the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    const response = await GET(request("Bearer cron-secret-value"));
    await expect(response.json()).resolves.toEqual({ ok: true, sent: 3, retried: 1, failed: 0 });
    expect(deliverOutboxEmails).toHaveBeenCalledOnce();
  });
});
