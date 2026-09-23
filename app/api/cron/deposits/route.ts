import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/src/lib/cron-auth";
import { db } from "@/src/lib/db";
import { settleOverdueDeposits } from "@/src/modules/payments/reconciliation";

/**
 * Periodic deposit sweep: reconciles overdue checkouts with Mercado Pago and releases the unpaid
 * ones, so expiry does not depend on someone opening the booking page. Vercel Cron (or any external
 * scheduler) calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const rejection = rejectUnauthorizedCron(request);
  if (rejection) return rejection;

  const expired = await settleOverdueDeposits(db);
  return NextResponse.json({ ok: true, expired });
}
