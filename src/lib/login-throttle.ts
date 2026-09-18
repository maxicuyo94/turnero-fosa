import type { PrismaClient } from "@prisma/client";

/**
 * Brute-force protection for the internal sign-in. Limits are counted in PostgreSQL so every
 * serverless instance shares them. A username locks after a few failures; an IP address gets a
 * wider budget so a shared workshop network is not locked out by one mistyped password.
 */
export const loginThrottlePolicy = {
  windowMinutes: 15,
  lockMinutes: 15,
  maxFailures: { user: 5, ip: 20 },
} as const;

export type LoginThrottleRecord = { key: string; failures: number; windowStart: Date; lockedUntil: Date | null };

export type LoginThrottleStore = {
  find(keys: string[]): Promise<LoginThrottleRecord[]>;
  save(record: LoginThrottleRecord): Promise<void>;
  clear(key: string): Promise<void>;
};

export function loginThrottleKeys(input: { username: string; ip: string | null }): string[] {
  return [`user:${input.username}`, ...(input.ip ? [`ip:${input.ip}`] : [])];
}

export function isLocked(records: LoginThrottleRecord[], now: Date): boolean {
  return records.some((record) => record.lockedUntil !== null && record.lockedUntil > now);
}

/** Next state of one key after a failed attempt: a fresh window resets the count. */
export function registerFailure(current: LoginThrottleRecord | undefined, key: string, now: Date): LoginThrottleRecord {
  const inWindow = current !== undefined &&
    now.getTime() - current.windowStart.getTime() < loginThrottlePolicy.windowMinutes * 60_000;
  const windowStart = inWindow ? current.windowStart : now;
  const failures = inWindow ? current.failures + 1 : 1;
  const limit = key.startsWith("ip:") ? loginThrottlePolicy.maxFailures.ip : loginThrottlePolicy.maxFailures.user;
  const stillLocked = current?.lockedUntil && current.lockedUntil > now ? current.lockedUntil : null;
  return {
    key,
    failures,
    windowStart,
    lockedUntil: failures >= limit ? new Date(now.getTime() + loginThrottlePolicy.lockMinutes * 60_000) : stillLocked,
  };
}

export async function checkLoginAllowed(store: LoginThrottleStore, keys: string[], now = new Date()): Promise<boolean> {
  return !isLocked(await store.find(keys), now);
}

export async function recordLoginFailure(store: LoginThrottleStore, keys: string[], now = new Date()): Promise<void> {
  const existing = new Map((await store.find(keys)).map((record) => [record.key, record]));
  for (const key of keys) await store.save(registerFailure(existing.get(key), key, now));
}

/** A successful sign-in clears the username counter; the IP budget keeps running out its window. */
export async function recordLoginSuccess(store: LoginThrottleStore, username: string): Promise<void> {
  await store.clear(`user:${username}`);
}

export class PrismaLoginThrottleStore implements LoginThrottleStore {
  constructor(private readonly prisma: PrismaClient) {}

  async find(keys: string[]) {
    return this.prisma.loginThrottle.findMany({
      where: { key: { in: keys } },
      select: { key: true, failures: true, windowStart: true, lockedUntil: true },
    });
  }

  async save(record: LoginThrottleRecord) {
    const { key, ...data } = record;
    await this.prisma.loginThrottle.upsert({ where: { key }, create: record, update: data });
  }

  async clear(key: string) {
    await this.prisma.loginThrottle.deleteMany({ where: { key } });
  }
}

/** First hop of X-Forwarded-For, as set by the hosting proxy (Vercel), or null when unknown. */
export function clientIpFromHeaders(headers: Headers | undefined): string | null {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip")?.trim() || null;
}
