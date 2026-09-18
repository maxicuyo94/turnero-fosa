import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { settleOverdueDeposits } from "@/src/modules/payments/reconciliation";

/**
 * Periodic deposit sweep: reconciles overdue checkouts with Mercado Pago and releases the unpaid
 * ones, so expiry does not depend on someone opening the booking page. Vercel Cron (or any external
 * scheduler) calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const expired = await settleOverdueDeposits(db);
  return NextResponse.json({ ok: true, expired });
}

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
