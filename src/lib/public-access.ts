import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { allowPublicAccessAttempt } from "@/src/lib/composition";
import { clientIpFromHeaders } from "@/src/lib/rate-limit";

/** Limits secret-link lookups before queries, cancellation previews and provider reconciliation. */
export async function guardPublicAccess(): Promise<void> {
  if (!await allowPublicAccessAttempt(clientIpFromHeaders(await headers()))) notFound();
}
