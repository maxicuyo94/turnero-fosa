import { afterEach, describe, expect, it, vi } from "vitest";

const settleOverdueDeposits = vi.fn(async () => 2);
vi.mock("@/src/lib/db", () => ({ db: {} }));
vi.mock("@/src/modules/payments/reconciliation", () => ({ settleOverdueDeposits }));

const { GET } = await import("@/app/api/cron/deposits/route");

const request = (authorization?: string) =>
  new Request("https://turnos.example/api/cron/deposits", { headers: authorization ? { authorization } : {} });

describe("deposit sweep cron endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    settleOverdueDeposits.mockClear();
  });

  it("stays closed until a secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer anything"))).status).toBe(503);
    expect(settleOverdueDeposits).not.toHaveBeenCalled();
  });

  it("rejects callers without the bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong-secret-value"))).status).toBe(401);
    expect(settleOverdueDeposits).not.toHaveBeenCalled();
  });

  it("runs the sweep for the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, expired: 2 });
    expect(settleOverdueDeposits).toHaveBeenCalledOnce();
  });
});
