import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/src/lib/cron-auth";
import { settleShopOrders } from "@/src/lib/composition";

export async function GET(request: Request) {
  const rejection = rejectUnauthorizedCron(request);
  if (rejection) return rejection;
  return NextResponse.json({ ok: true, processed: await settleShopOrders() });
}
