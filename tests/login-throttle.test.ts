import { describe, expect, it } from "vitest";
import {
  checkLoginAllowed,
  clientIpFromHeaders,
  loginThrottleKeys,
  loginThrottlePolicy,
  recordLoginFailure,
  recordLoginSuccess,
  type LoginThrottleRecord,
  type LoginThrottleStore,
} from "@/src/lib/login-throttle";
import { verifyPasswordAgainstDummy } from "@/src/lib/password";

class InMemoryThrottleStore implements LoginThrottleStore {
  records = new Map<string, LoginThrottleRecord>();
  async find(keys: string[]) { return keys.flatMap((key) => this.records.get(key) ?? []); }
  async save(record: LoginThrottleRecord) { this.records.set(record.key, record); }
  async clear(key: string) { this.records.delete(key); }
}

const minutes = (value: number) => value * 60_000;
const start = new Date("2026-09-18T12:00:00Z");
const at = (offsetMinutes: number) => new Date(start.getTime() + minutes(offsetMinutes));

describe("internal login throttle", () => {
  it("locks a username after repeated failures and unlocks when the lock expires", async () => {
    const store = new InMemoryThrottleStore();
    const keys = loginThrottleKeys({ username: "admin", ip: "203.0.113.7" });
    for (let attempt = 0; attempt < loginThrottlePolicy.maxFailures.user - 1; attempt += 1) {
      await recordLoginFailure(store, keys, at(attempt));
    }
    expect(await checkLoginAllowed(store, keys, at(4))).toBe(true);

    await recordLoginFailure(store, keys, at(4));
    expect(await checkLoginAllowed(store, keys, at(5))).toBe(false);
    expect(await checkLoginAllowed(store, loginThrottleKeys({ username: "other", ip: "198.51.100.1" }), at(5))).toBe(true);
    expect(await checkLoginAllowed(store, keys, at(4 + loginThrottlePolicy.lockMinutes + 1))).toBe(true);
  });

  it("starts a new count once the window has passed", async () => {
    const store = new InMemoryThrottleStore();
    const keys = loginThrottleKeys({ username: "admin", ip: null });
    for (let attempt = 0; attempt < 4; attempt += 1) await recordLoginFailure(store, keys, at(attempt));
    await recordLoginFailure(store, keys, at(loginThrottlePolicy.windowMinutes + 5));
    expect(store.records.get("user:admin")?.failures).toBe(1);
    expect(await checkLoginAllowed(store, keys, at(loginThrottlePolicy.windowMinutes + 6))).toBe(true);
  });

  it("gives an IP a wider budget across usernames", async () => {
    const store = new InMemoryThrottleStore();
    for (let attempt = 0; attempt < loginThrottlePolicy.maxFailures.ip; attempt += 1) {
      await recordLoginFailure(store, loginThrottleKeys({ username: `user-${attempt}`, ip: "203.0.113.7" }), at(0));
    }
    expect(await checkLoginAllowed(store, loginThrottleKeys({ username: "fresh", ip: "203.0.113.7" }), at(1))).toBe(false);
    expect(await checkLoginAllowed(store, loginThrottleKeys({ username: "fresh", ip: "203.0.113.8" }), at(1))).toBe(true);
  });

  it("clears the username counter after a successful sign-in", async () => {
    const store = new InMemoryThrottleStore();
    const keys = loginThrottleKeys({ username: "admin", ip: "203.0.113.7" });
    await recordLoginFailure(store, keys, at(0));
    await recordLoginSuccess(store, "admin");
    expect(store.records.has("user:admin")).toBe(false);
    expect(store.records.get("ip:203.0.113.7")?.failures).toBe(1);
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
