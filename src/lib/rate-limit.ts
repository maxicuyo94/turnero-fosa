import type { PrismaClient } from "@prisma/client";

/**
 * Attempt budgets counted in PostgreSQL, so every serverless instance shares them. Each attempt is
 * counted before the work it guards and under a row lock, so a burst of parallel requests cannot
 * slip past the limit or lose counts.
 */
export type RateLimitPolicy = { windowMinutes: number; lockMinutes: number; maxAttempts: number };

/**
 * Internal sign-in. A username locks after a few failed attempts; an IP address gets a wider budget
 * so a shared workshop network is not locked out by one mistyped password. Attempts are counted
 * while in flight and refunded when they succeed, so only failures use up a budget.
 */
export const loginRateLimit = {
  user: { windowMinutes: 15, lockMinutes: 15, maxAttempts: 5 },
  ip: { windowMinutes: 15, lockMinutes: 15, maxAttempts: 20 },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Public booking per client address. Generous enough for a family or a carrier-grade NAT, low enough
 * that a script cannot fill the agenda.
 */
export const bookingRateLimit = { windowMinutes: 60, lockMinutes: 60, maxAttempts: 10 } as const satisfies RateLimitPolicy;

export type RateLimitRecord = { key: string; failures: number; windowStart: Date; lockedUntil: Date | null };

export type RateLimitStore = {
  /** Replaces the key's record with `next(current)` atomically and returns what was stored. */
  update(key: string, next: (current: RateLimitRecord | undefined) => RateLimitRecord): Promise<RateLimitRecord>;
  clear(key: string): Promise<void>;
};

/**
 * Next state of one key after an attempt. A locked key stays as it is, so attempts during a lock
 * neither count nor extend it; a fresh window resets the count; going over the budget locks.
 */
export function registerAttempt(
  current: RateLimitRecord | undefined,
  key: string,
  now: Date,
  policy: RateLimitPolicy,
): RateLimitRecord {
  if (current && isLocked(current, now)) return current;
  const inWindow = current !== undefined && now.getTime() - current.windowStart.getTime() < policy.windowMinutes * 60_000;
  const failures = inWindow ? current.failures + 1 : 1;
  return {
    key,
    failures,
    windowStart: inWindow ? current.windowStart : now,
    lockedUntil: failures > policy.maxAttempts ? new Date(now.getTime() + policy.lockMinutes * 60_000) : null,
  };
}

export function isLocked(record: RateLimitRecord, now: Date): boolean {
  return record.lockedUntil !== null && record.lockedUntil > now;
}

/** Gives one attempt back to a key, unless the key is locked: a lock is never shortened. */
export function refundAttempt(current: RateLimitRecord | undefined, key: string, now: Date): RateLimitRecord {
  if (!current) return { key, failures: 0, windowStart: new Date(0), lockedUntil: null };
  return isLocked(current, now) ? current : { ...current, failures: Math.max(0, current.failures - 1) };
}

/**
 * Counts the attempt against every key; false when any of them is over its budget. A refused attempt
 * is given back to the keys that still had room, so a lock on one key does not drain the others.
 */
async function consumeAttempt(
  store: RateLimitStore,
  budgets: Array<{ key: string; policy: RateLimitPolicy }>,
  now: Date,
): Promise<boolean> {
  const unlocked: string[] = [];
  for (const { key, policy } of budgets) {
    const record = await store.update(key, (current) => registerAttempt(current, key, now, policy));
    if (!isLocked(record, now)) unlocked.push(key);
  }
  if (unlocked.length === budgets.length) return true;
  for (const key of unlocked) await store.update(key, (current) => refundAttempt(current, key, now));
  return false;
}

export function loginThrottleKeys(input: { username: string; ip: string | null }): string[] {
  return [`user:${input.username}`, ...(input.ip ? [`ip:${input.ip}`] : [])];
}

/** Counts a sign-in attempt before the password is checked; false means refuse it. */
export function beginLoginAttempt(store: RateLimitStore, keys: string[], now = new Date()): Promise<boolean> {
  return consumeAttempt(
    store,
    keys.map((key) => ({ key, policy: key.startsWith("ip:") ? loginRateLimit.ip : loginRateLimit.user })),
    now,
  );
}

/** A successful sign-in clears the username counter and gives its attempt back to the IP budget. */
export async function recordLoginSuccess(store: RateLimitStore, keys: string[], now = new Date()): Promise<void> {
  for (const key of keys) {
    if (key.startsWith("user:")) await store.clear(key);
    else await store.update(key, (current) => refundAttempt(current, key, now));
  }
}

/** Counts a public booking submission; without a known address there is nothing to count against. */
export function beginBookingAttempt(store: RateLimitStore, ip: string | null, now = new Date()): Promise<boolean> {
  return ip ? consumeAttempt(store, [{ key: `booking-ip:${ip}`, policy: bookingRateLimit }], now) : Promise.resolve(true);
}

export class PrismaRateLimitStore implements RateLimitStore {
  constructor(private readonly prisma: PrismaClient) {}

  async update(key: string, next: (current: RateLimitRecord | undefined) => RateLimitRecord) {
    return this.prisma.$transaction(async (tx) => {
      // A placeholder from the epoch is always outside the window, so it reads as "no record yet";
      // inserting it first gives concurrent first attempts a row to queue on.
      await tx.$executeRaw`
        INSERT INTO "LoginThrottle" ("key", "failures", "windowStart", "updatedAt")
        VALUES (${key}, 0, ${new Date(0)}, ${new Date()})
        ON CONFLICT ("key") DO NOTHING`;
      const [current] = await tx.$queryRaw<RateLimitRecord[]>`
        SELECT "key", "failures", "windowStart", "lockedUntil" FROM "LoginThrottle" WHERE "key" = ${key} FOR UPDATE`;
      const record = next(current);
      return tx.loginThrottle.update({
        where: { key },
        data: { failures: record.failures, windowStart: record.windowStart, lockedUntil: record.lockedUntil },
        select: { key: true, failures: true, windowStart: true, lockedUntil: true },
      });
    });
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
