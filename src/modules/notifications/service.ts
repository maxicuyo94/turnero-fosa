export type EmailNotificationEvent = "PUBLIC_BOOKING_CREATED" | "APPOINTMENT_STATUS_CHANGED" | "APPOINTMENT_INTERVAL_CHANGED";

/**
 * An email a business change owes the customer. Repositories store it in the outbox in the same
 * write as the change itself, so an appointment never exists without its email or the other way round.
 */
export type EmailNotificationDraft = {
  event: EmailNotificationEvent;
  recipient: string;
  subject: string;
  text: string;
};

export type EmailNotificationMessage = EmailNotificationDraft & {
  appointmentId: string | null;
};

export type EmailNotificationResult = {
  providerId: string | null;
};

export type NotificationPort = {
  /** `idempotencyKey` is stable per outbox row, so a retried delivery is not sent twice. */
  sendEmail(message: EmailNotificationMessage & { idempotencyKey: string }): Promise<EmailNotificationResult>;
};

export type PendingEmail = EmailNotificationMessage & {
  id: string;
  /** Delivery attempts including the one this claim starts. */
  attempts: number;
  createdAt: Date;
};

export type EmailDeliveryRepository = {
  /**
   * Leases up to `limit` due emails until `leaseUntil`. Concurrent dispatchers never receive the same
   * row, and a dispatcher that dies mid-send only delays the email until the lease runs out.
   */
  claimDueEmails(input: { now: Date; limit: number; leaseUntil: Date }): Promise<PendingEmail[]>;
  markSent(id: string, providerId: string | null, sentAt: Date): Promise<void>;
  markRetry(id: string, errorMessage: string, nextAttemptAt: Date): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
};

export const emailDeliveryPolicy = {
  batchSize: 20,
  maxAttempts: 5,
  leaseMs: 5 * 60_000,
  /** A confirmation that arrives a day late does more harm than good. */
  maxAgeMs: 24 * 60 * 60_000,
  retryDelayMs(attempts: number): number {
    return Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1));
  },
} as const;

export type EmailDeliverySummary = { sent: number; retried: number; failed: number };

/** Sends the due outbox emails once each; failures are rescheduled with backoff until the policy gives up. */
export async function deliverPendingEmails(
  repository: EmailDeliveryRepository,
  port: NotificationPort,
  now = new Date(),
): Promise<EmailDeliverySummary> {
  const summary: EmailDeliverySummary = { sent: 0, retried: 0, failed: 0 };
  const claimed = await repository.claimDueEmails({
    now,
    limit: emailDeliveryPolicy.batchSize,
    leaseUntil: new Date(now.getTime() + emailDeliveryPolicy.leaseMs),
  });

  for (const email of claimed) {
    if (now.getTime() - email.createdAt.getTime() > emailDeliveryPolicy.maxAgeMs) {
      await repository.markFailed(email.id, "Expired before it could be delivered.");
      summary.failed += 1;
      continue;
    }

    try {
      const result = await port.sendEmail({
        idempotencyKey: email.id,
        event: email.event,
        appointmentId: email.appointmentId,
        recipient: email.recipient,
        subject: email.subject,
        text: email.text,
      });
      await repository.markSent(email.id, result.providerId, now);
      summary.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown notification error.";
      if (email.attempts >= emailDeliveryPolicy.maxAttempts) {
        await repository.markFailed(email.id, message);
        summary.failed += 1;
      } else {
        await repository.markRetry(email.id, message, new Date(now.getTime() + emailDeliveryPolicy.retryDelayMs(email.attempts)));
        summary.retried += 1;
      }
    }
  }

  return summary;
}
