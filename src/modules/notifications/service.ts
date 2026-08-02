export type EmailNotificationEvent = "PUBLIC_BOOKING_CREATED" | "APPOINTMENT_STATUS_CHANGED" | "APPOINTMENT_INTERVAL_CHANGED";

export type EmailNotificationMessage = {
  event: EmailNotificationEvent;
  appointmentId: string;
  recipient: string;
  subject: string;
  text: string;
};

export type EmailNotificationResult = {
  providerId: string | null;
};

export type NotificationPort = {
  sendEmail(message: EmailNotificationMessage): Promise<EmailNotificationResult>;
};

export type NotificationLogRepository = {
  logEmail(input: {
    appointmentId: string;
    event: EmailNotificationEvent;
    recipient: string;
    status: "SENT" | "FAILED";
    providerId?: string | null;
    errorMessage?: string | null;
  }): Promise<void>;
};

export async function sendEmailAndLog(
  repository: NotificationLogRepository,
  port: NotificationPort,
  message: EmailNotificationMessage,
): Promise<void> {
  try {
    const result = await port.sendEmail(message);
    await logWithoutThrowing(repository, {
      appointmentId: message.appointmentId,
      event: message.event,
      recipient: message.recipient,
      status: "SENT",
      providerId: result.providerId,
    });
  } catch (error) {
    await logWithoutThrowing(repository, {
      appointmentId: message.appointmentId,
      event: message.event,
      recipient: message.recipient,
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown notification error.",
    });
  }
}

async function logWithoutThrowing(
  repository: NotificationLogRepository,
  input: Parameters<NotificationLogRepository["logEmail"]>[0],
): Promise<void> {
  try {
    await repository.logEmail(input);
  } catch {
    // Notification persistence is best-effort and must not affect the booking flow.
  }
}
