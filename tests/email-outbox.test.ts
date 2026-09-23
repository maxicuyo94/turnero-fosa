import { describe, expect, it } from "vitest";
import {
  deliverPendingEmails,
  emailDeliveryPolicy,
  type EmailDeliveryRepository,
  type EmailNotificationMessage,
  type NotificationPort,
  type PendingEmail,
} from "@/src/modules/notifications/service";

const now = new Date("2026-09-23T12:00:00Z");

describe("email outbox delivery", () => {
  it("sends each claimed email once, keyed by its outbox id", async () => {
    const repository = new InMemoryDeliveryRepository([pending({ id: "mail-1" })]);
    const port = new ScriptedPort(["ok"]);

    const summary = await deliverPendingEmails(repository, port, now);

    expect(summary).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(port.sent).toEqual([expect.objectContaining({ idempotencyKey: "mail-1", recipient: "ada@example.com" })]);
    expect(repository.outcomes).toEqual([{ id: "mail-1", status: "SENT", providerId: "provider-mail-1" }]);
  });

  it("reschedules a failed send with growing backoff", async () => {
    const repository = new InMemoryDeliveryRepository([pending({ id: "mail-1", attempts: 1 }), pending({ id: "mail-2", attempts: 3 })]);

    const summary = await deliverPendingEmails(repository, new ScriptedPort(["fail", "fail"]), now);

    expect(summary).toEqual({ sent: 0, retried: 2, failed: 0 });
    expect(repository.outcomes).toEqual([
      { id: "mail-1", status: "RETRY", error: "Provider down.", nextAttemptAt: new Date(now.getTime() + 60_000) },
      { id: "mail-2", status: "RETRY", error: "Provider down.", nextAttemptAt: new Date(now.getTime() + 4 * 60_000) },
    ]);
  });

  it("gives up after the last allowed attempt", async () => {
    const repository = new InMemoryDeliveryRepository([pending({ attempts: emailDeliveryPolicy.maxAttempts })]);

    const summary = await deliverPendingEmails(repository, new ScriptedPort(["fail"]), now);

    expect(summary).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(repository.outcomes).toEqual([{ id: "mail", status: "FAILED", error: "Provider down." }]);
  });

  it("never sends an email that waited longer than the policy allows", async () => {
    const stale = pending({ createdAt: new Date(now.getTime() - emailDeliveryPolicy.maxAgeMs - 1) });
    const repository = new InMemoryDeliveryRepository([stale]);
    const port = new ScriptedPort([]);

    await deliverPendingEmails(repository, port, now);

    expect(port.sent).toEqual([]);
    expect(repository.outcomes).toEqual([{ id: "mail", status: "FAILED", error: "Expired before it could be delivered." }]);
  });

  it("claims one batch leased for the policy window", async () => {
    const repository = new InMemoryDeliveryRepository([]);

    await deliverPendingEmails(repository, new ScriptedPort([]), now);

    expect(repository.claims).toEqual([
      { now, limit: emailDeliveryPolicy.batchSize, leaseUntil: new Date(now.getTime() + emailDeliveryPolicy.leaseMs) },
    ]);
  });
});

function pending(overrides: Partial<PendingEmail> = {}): PendingEmail {
  return {
    id: "mail",
    appointmentId: "appt-1",
    event: "PUBLIC_BOOKING_CREATED",
    recipient: "ada@example.com",
    subject: "Recibimos tu turno",
    text: "Código: ABCD234567.",
    attempts: 1,
    createdAt: now,
    ...overrides,
  };
}

class ScriptedPort implements NotificationPort {
  sent: Array<EmailNotificationMessage & { idempotencyKey: string }> = [];

  constructor(private readonly script: Array<"ok" | "fail">) {}

  async sendEmail(message: EmailNotificationMessage & { idempotencyKey: string }) {
    if (this.script.shift() === "fail") throw new Error("Provider down.");
    this.sent.push(message);
    return { providerId: `provider-${message.idempotencyKey}` };
  }
}

class InMemoryDeliveryRepository implements EmailDeliveryRepository {
  claims: Array<{ now: Date; limit: number; leaseUntil: Date }> = [];
  outcomes: Array<Record<string, unknown>> = [];

  constructor(private readonly due: PendingEmail[]) {}

  async claimDueEmails(input: { now: Date; limit: number; leaseUntil: Date }) {
    this.claims.push(input);
    return this.due.splice(0, input.limit);
  }

  async markSent(id: string, providerId: string | null) {
    this.outcomes.push({ id, status: "SENT", providerId });
  }

  async markRetry(id: string, error: string, nextAttemptAt: Date) {
    this.outcomes.push({ id, status: "RETRY", error, nextAttemptAt });
  }

  async markFailed(id: string, error: string) {
    this.outcomes.push({ id, status: "FAILED", error });
  }
}
