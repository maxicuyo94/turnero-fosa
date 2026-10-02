import { describe, expect, it } from "vitest";
import {
  beginBookingAttempt,
  beginLoginAttempt,
  bookingRateLimit,
  clientIpFromHeaders,
  loginRateLimit,
  loginThrottleKeys,
  recordLoginSuccess,
  type RateLimitRecord,
  type RateLimitStore,
} from "@/src/lib/rate-limit";
import { verifyPasswordAgainstDummy } from "@/src/lib/password";

/** Applies each update one at a time, the way the row lock serializes them in PostgreSQL. */
class InMemoryRateLimitStore implements RateLimitStore {
  records = new Map<string, RateLimitRecord>();
  private queue: Promise<unknown> = Promise.resolve();
  update(key: string, next: (current: RateLimitRecord | undefined) => RateLimitRecord) {
    const result = this.queue.then(async () => {
      await Promise.resolve();
      const record = next(this.records.get(key));
      this.records.set(key, record);
      return record;
    });
    this.queue = result;
    return result;
  }
  async clear(key: string) { this.records.delete(key); }
}

const minutes = (value: number) => value * 60_000;
const start = new Date("2026-09-18T12:00:00Z");
const at = (offsetMinutes: number) => new Date(start.getTime() + minutes(offsetMinutes));

describe("internal login throttle", () => {
  it("allows the budget, refuses the next attempt and unlocks when the lock expires", async () => {
    const store = new InMemoryRateLimitStore();
    const keys = loginThrottleKeys({ username: "admin", ip: "203.0.113.7" });
    for (let attempt = 0; attempt < loginRateLimit.user.maxAttempts; attempt += 1) {
      expect(await beginLoginAttempt(store, keys, at(attempt))).toBe(true);
    }
    expect(await beginLoginAttempt(store, keys, at(5))).toBe(false);
    expect(await beginLoginAttempt(store, loginThrottleKeys({ username: "other", ip: "198.51.100.1" }), at(5))).toBe(true);
    // Attempts during the lock neither count nor extend it.
    expect(await beginLoginAttempt(store, keys, at(10))).toBe(false);
    expect(await beginLoginAttempt(store, keys, at(5 + loginRateLimit.user.lockMinutes + 1))).toBe(true);
  });

  it("counts a burst of parallel attempts without losing any", async () => {
    const store = new InMemoryRateLimitStore();
    const keys = loginThrottleKeys({ username: "admin", ip: null });
    const results = await Promise.all(Array.from({ length: 12 }, () => beginLoginAttempt(store, keys, at(0))));
    expect(results.filter(Boolean)).toHaveLength(loginRateLimit.user.maxAttempts);
  });

  it("starts a new count once the window has passed", async () => {
    const store = new InMemoryRateLimitStore();
    const keys = loginThrottleKeys({ username: "admin", ip: null });
    for (let attempt = 0; attempt < 4; attempt += 1) await beginLoginAttempt(store, keys, at(attempt));
    await beginLoginAttempt(store, keys, at(loginRateLimit.user.windowMinutes + 5));
    expect(store.records.get("user:admin")?.failures).toBe(1);
  });

  it("gives an IP a wider budget across usernames", async () => {
    const store = new InMemoryRateLimitStore();
    for (let attempt = 0; attempt < loginRateLimit.ip.maxAttempts; attempt += 1) {
      expect(await beginLoginAttempt(store, loginThrottleKeys({ username: `user-${attempt}`, ip: "203.0.113.7" }), at(0))).toBe(true);
    }
    expect(await beginLoginAttempt(store, loginThrottleKeys({ username: "fresh", ip: "203.0.113.7" }), at(1))).toBe(false);
    expect(await beginLoginAttempt(store, loginThrottleKeys({ username: "fresh", ip: "203.0.113.8" }), at(1))).toBe(true);
  });

  it("clears the username counter and refunds the IP after a successful sign-in", async () => {
    const store = new InMemoryRateLimitStore();
    const keys = loginThrottleKeys({ username: "admin", ip: "203.0.113.7" });
    await beginLoginAttempt(store, keys, at(0));
    await recordLoginSuccess(store, keys, at(0));
    expect(store.records.has("user:admin")).toBe(false);
    expect(store.records.get("ip:203.0.113.7")?.failures).toBe(0);
  });

  it("never locks an address out for signing in successfully many times", async () => {
    const store = new InMemoryRateLimitStore();
    for (let attempt = 0; attempt < loginRateLimit.ip.maxAttempts * 2; attempt += 1) {
      const keys = loginThrottleKeys({ username: `staff-${attempt % 3}`, ip: "203.0.113.7" });
      expect(await beginLoginAttempt(store, keys, at(0))).toBe(true);
      await recordLoginSuccess(store, keys, at(0));
    }
  });

  it("does not drain the IP budget with attempts refused by a locked username", async () => {
    const store = new InMemoryRateLimitStore();
    const keys = loginThrottleKeys({ username: "admin", ip: "203.0.113.7" });
    for (let attempt = 0; attempt <= loginRateLimit.user.maxAttempts; attempt += 1) await beginLoginAttempt(store, keys, at(0));
    const ipAfterLock = store.records.get("ip:203.0.113.7")?.failures;
    for (let attempt = 0; attempt < 30; attempt += 1) expect(await beginLoginAttempt(store, keys, at(1))).toBe(false);
    expect(store.records.get("ip:203.0.113.7")?.failures).toBe(ipAfterLock);
    expect(await beginLoginAttempt(store, loginThrottleKeys({ username: "other", ip: "203.0.113.7" }), at(1))).toBe(true);
  });

  it("reads the client address set by the proxy", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });

  it("always rejects the dummy password check used for unknown users", async () => {
    await expect(verifyPasswordAgainstDummy("anything")).resolves.toBe(false);
  });
});

describe("public booking rate limit", () => {
  it("limits submissions per address and lets other addresses through", async () => {
    const store = new InMemoryRateLimitStore();
    for (let attempt = 0; attempt < bookingRateLimit.maxAttempts; attempt += 1) {
      expect(await beginBookingAttempt(store, "203.0.113.7", at(attempt))).toBe(true);
    }
    expect(await beginBookingAttempt(store, "203.0.113.7", at(20))).toBe(false);
    expect(await beginBookingAttempt(store, "198.51.100.1", at(20))).toBe(true);
    expect(await beginBookingAttempt(store, "203.0.113.7", at(20 + bookingRateLimit.lockMinutes + 1))).toBe(true);
  });

  it("does not count requests without a known address", async () => {
    const store = new InMemoryRateLimitStore();
    expect(await beginBookingAttempt(store, null, at(0))).toBe(true);
    expect(store.records.size).toBe(0);
  });
});
