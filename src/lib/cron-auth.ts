import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Guards a cron endpoint with `Authorization: Bearer $CRON_SECRET` (what Vercel Cron sends).
 * Returns the response to send when the call is refused, or null when it may proceed.
 */
export function rejectUnauthorizedCron(request: Request, env: Record<string, string | undefined> = process.env): NextResponse | null {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const authorized = expected.length === received.length && timingSafeEqual(expected, received);
  return authorized ? null : NextResponse.json({ ok: false }, { status: 401 });
}
