import type { PrismaClient } from "@prisma/client";
import type { NotificationLogRepository } from "@/src/modules/notifications/service";

export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async logEmail(input: Parameters<NotificationLogRepository["logEmail"]>[0]): Promise<void> {
    await this.prisma.emailLog.create({
      data: {
        appointmentId: input.appointmentId,
        event: input.event,
        recipient: input.recipient,
        status: input.status,
        providerId: input.providerId,
        errorMessage: input.errorMessage,
      },
    });
  }
}
