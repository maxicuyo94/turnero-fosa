import type { PrismaClient } from "@prisma/client";
import type {
  EmailDeliveryRepository,
  EmailNotificationDraft,
  EmailNotificationEvent,
  PendingEmail,
} from "@/src/modules/notifications/service";

/** Nested-create payload that queues an email in the outbox as part of the write that caused it. */
export function emailOutboxEntry(draft: EmailNotificationDraft) {
  return {
    event: draft.event,
    recipient: draft.recipient,
    subject: draft.subject,
    body: draft.text,
    status: "PENDING" as const,
  };
}

type ClaimedRow = {
  id: string;
  appointmentId: string | null;
  event: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  attempts: number;
  createdAt: Date;
};

export class PrismaEmailDeliveryRepository implements EmailDeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async claimDueEmails(input: { now: Date; limit: number; leaseUntil: Date }): Promise<PendingEmail[]> {
    // SKIP LOCKED lets several dispatchers run at once without ever claiming the same row.
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "EmailLog"
      SET "attempts" = "attempts" + 1, "nextAttemptAt" = ${input.leaseUntil}
      WHERE "id" IN (
        SELECT "id" FROM "EmailLog"
        WHERE "status" = 'PENDING'::"EmailLogStatus" AND "nextAttemptAt" <= ${input.now}
        ORDER BY "createdAt" ASC
        LIMIT ${input.limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "appointmentId", "event", "recipient", "subject", "body", "attempts", "createdAt"`;

    return rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointmentId,
      event: row.event as EmailNotificationEvent,
      recipient: row.recipient,
      subject: row.subject ?? "",
      text: row.body ?? "",
      attempts: row.attempts,
      createdAt: row.createdAt,
    }));
  }

  async markSent(id: string, providerId: string | null, sentAt: Date): Promise<void> {
    await this.prisma.emailLog.update({ where: { id }, data: { status: "SENT", providerId, sentAt, errorMessage: null } });
  }

  async markRetry(id: string, errorMessage: string, nextAttemptAt: Date): Promise<void> {
    await this.prisma.emailLog.update({ where: { id }, data: { errorMessage, nextAttemptAt } });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.emailLog.update({ where: { id }, data: { status: "FAILED", errorMessage } });
  }
}
