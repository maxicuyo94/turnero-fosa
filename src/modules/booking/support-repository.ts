import type { PrismaClient } from "@prisma/client";
import type { CodeRecoveryRepository } from "@/src/modules/booking/code-recovery";
import { emailOutboxEntry } from "@/src/modules/notifications/prisma-repository";

export class PrismaCodeRecoveryRepository implements CodeRecoveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async queueCodesForEmail(email: string, now: Date, draft: Parameters<CodeRecoveryRepository["queueCodesForEmail"]>[2]) {
    return this.prisma.$transaction(async (tx) => {
      // Only the email captured on this booking: a shared customer's email is not proof of ownership.
      const appointments = await tx.appointment.findMany({
        where: { contactEmail: { equals: email, mode: "insensitive" }, startAt: { gt: now }, status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] } },
        orderBy: { startAt: "asc" }, take: 10,
        select: { publicCode: true, startAt: true, service: { select: { name: true } } },
      });
      if (!appointments.length) return false;
      await tx.emailLog.create({ data: emailOutboxEntry(draft(appointments.map((appointment) => ({ ...appointment, serviceName: appointment.service.name })))) });
      return true;
    });
  }
}

/** Called only after the cancellation secret was verified by the booking service. */
export async function getCancellationPaymentSummary(prisma: PrismaClient, appointmentId: string) {
  const attempts = await prisma.depositPaymentAttempt.findMany({
    where: { appointmentId }, orderBy: { createdAt: "desc" },
    select: { status: true, amountCents: true },
  });
  return attempts.find((attempt) => ["APPROVED", "REFUNDED", "CHARGED_BACK"].includes(attempt.status)) ?? attempts[0] ?? null;
}
