import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/src/lib/cron-auth";
import { deliverOutboxEmails } from "@/src/lib/composition";

/**
 * Retries the email outbox. Requests that queue an email already try to deliver it right after
 * responding; this sweep picks up whatever failed or was cut short. Same bearer as the deposit sweep.
 */
export async function GET(request: Request) {
  const rejection = rejectUnauthorizedCron(request);
  if (rejection) return rejection;

  const summary = await deliverOutboxEmails();
  return NextResponse.json({ ok: true, ...summary });
}
