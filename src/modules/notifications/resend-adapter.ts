import type { AppEnv } from "@/src/lib/env";
import type { EmailNotificationMessage, EmailNotificationResult, NotificationPort } from "@/src/modules/notifications/service";

type ResendResponse = {
  id?: string;
  message?: string;
};

export class ResendNotificationPort implements NotificationPort {
  constructor(private readonly env: Pick<AppEnv, "RESEND_API_KEY" | "EMAIL_FROM">) {}

  async sendEmail(message: EmailNotificationMessage): Promise<EmailNotificationResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.env.EMAIL_FROM,
        to: message.recipient,
        subject: message.subject,
        text: message.text,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;
    if (!response.ok) {
      throw new Error(payload.message ?? `Resend email delivery failed with status ${response.status}.`);
    }

    return { providerId: payload.id ?? null };
  }
}
