import type { DepositPaymentStatus, PrismaClient } from "@prisma/client";
import type { DepositPaymentRepository } from "@/src/modules/payments/service";

const unpaidStatuses: DepositPaymentStatus[] = ["CREATED", "PENDING", "ERROR", "REJECTED", "CANCELLED", "EXPIRED"];

export class PrismaDepositPaymentRepository implements DepositPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDepositPolicy() {
    const settings = await this.prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    return {
      required: settings.depositRequired,
      amountCents: settings.depositAmountCents,
      expirationMinutes: settings.depositExpirationMinutes,
    };
  }

  async findAppointmentForDeposit(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, customer: true },
    });
    return appointment ? {
      id: appointment.id,
      publicCode: appointment.publicCode,
      serviceName: appointment.service.name,
      customerName: appointment.customer.fullName,
      customerEmail: appointment.customer.email,
      status: appointment.status,
    } : null;
  }

  async findReusableAttempt(appointmentId: string, now: Date) {
    return this.prisma.depositPaymentAttempt.findFirst({
      where: {
        appointmentId,
        status: { in: ["CREATED", "PENDING"] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAttempt(input: Parameters<DepositPaymentRepository["createAttempt"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      // The same appointment row serializes checkout creation, expiry and webhooks.
      await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${input.appointmentId} FOR UPDATE`;
      const appointment = await tx.appointment.findUnique({ where: { id: input.appointmentId } });
      if (appointment?.status !== "PENDING_CONFIRMATION") return null;
      return tx.depositPaymentAttempt.create({ data: input });
    });
  }

  async markPreferenceCreated(input: Parameters<DepositPaymentRepository["markPreferenceCreated"]>[0]) {
    return this.prisma.depositPaymentAttempt.update({
      where: { id: input.attemptId },
      data: {
        preferenceId: input.preferenceId,
        checkoutUrl: input.checkoutUrl,
        status: "PENDING",
        statusDetail: null,
      },
    });
  }

  async markAttemptError(attemptId: string, detail: string) {
    await this.prisma.depositPaymentAttempt.update({
      where: { id: attemptId },
      data: { status: "ERROR", statusDetail: detail },
    });
  }

  async findByExternalReference(externalReference: string) {
    return this.prisma.depositPaymentAttempt.findUnique({ where: { externalReference } });
  }

  async getPublicAttempt(externalReference: string) {
    const attempt = await this.prisma.depositPaymentAttempt.findUnique({
      where: { externalReference },
      include: { appointment: { select: { publicCode: true, status: true } } },
    });
    return attempt ? {
      status: attempt.status,
      amountCents: attempt.amountCents,
      publicCode: attempt.appointment.publicCode,
      appointmentStatus: attempt.appointment.status,
    } : null;
  }

  async getPublicCheckout(publicCode: string, now = new Date()) {
    return this.prisma.depositPaymentAttempt.findFirst({
      where: {
        appointment: { publicCode, status: "PENDING_CONFIRMATION" },
        status: { in: ["CREATED", "PENDING"] },
        expiresAt: { gt: now },
        checkoutUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { checkoutUrl: true, amountCents: true },
    });
  }

  async applyProviderPayment(input: Parameters<DepositPaymentRepository["applyProviderPayment"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.depositPaymentAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
      await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${target.appointmentId} FOR UPDATE`;
      const current = await tx.depositPaymentAttempt.findUniqueOrThrow({
        where: { id: input.attemptId },
        include: { appointment: true },
      });
      const attempt = await tx.depositPaymentAttempt.update({
        where: { id: current.id },
        data: {
          providerPaymentId: input.providerPaymentId,
          status: input.status,
          statusDetail: input.statusDetail,
          liveMode: input.liveMode,
          approvedAt: input.approvedAt,
          lastNotificationAt: new Date(),
        },
      });

      // A failed attempt does not cancel other checkouts. Reservation expiry owns
      // cancellation after the last attempt's deadline, leaving time to retry.
      if (input.status === "APPROVED" && current.appointment.status === "PENDING_CONFIRMATION") {
        await tx.appointment.update({
          where: { id: current.appointmentId },
          data: {
            status: "CONFIRMED",
            statusHistory: {
              create: {
                fromStatus: current.appointment.status,
                toStatus: "CONFIRMED",
                note: "Deposit approved by Mercado Pago webhook.",
              },
            },
          },
        });
      }
      return attempt;
    });
  }
}

export async function expireOverdueDepositReservations(prisma: PrismaClient, now = new Date()): Promise<number> {
  const overdue = await prisma.depositPaymentAttempt.findMany({
    where: {
      status: { in: unpaidStatuses },
      expiresAt: { lte: now },
      appointment: { status: "PENDING_CONFIRMATION", paymentAttempts: { none: { status: "APPROVED" } } },
    },
    select: { id: true, appointmentId: true },
  });
  if (overdue.length === 0) return 0;

  let expiredCount = 0;
  for (const appointmentId of new Set(overdue.map((item) => item.appointmentId))) {
    expiredCount += await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} FOR UPDATE`;
      const appointment = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { status: true } });
      if (appointment?.status !== "PENDING_CONFIRMATION") return 0;
      // Re-read under the lock: a retry or an approval may have arrived since
      // the candidate scan. Never expire an approved attempt from a stale list.
      const protectedAttempt = await tx.depositPaymentAttempt.findFirst({
        where: {
          appointmentId,
          OR: [{ status: "APPROVED" }, { status: { in: unpaidStatuses }, expiresAt: { gt: now } }],
        },
      });
      if (protectedAttempt) return 0;
      const expired = await tx.depositPaymentAttempt.updateMany({
        where: { appointmentId, status: { in: ["CREATED", "PENDING"] }, expiresAt: { lte: now } },
        data: { status: "EXPIRED", statusDetail: "Local reservation expiration reached." },
      });
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CANCELLED",
          statusHistory: {
            create: {
              fromStatus: "PENDING_CONFIRMATION",
              toStatus: "CANCELLED",
              note: "Deposit reservation expired before approval.",
            },
          },
        },
      });
      return expired.count;
    });
  }
  return expiredCount;
}
