import type { PrismaClient } from "@prisma/client";
import type { DepositPaymentRepository } from "@/src/modules/payments/service";

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
    return this.prisma.depositPaymentAttempt.create({ data: input });
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
      include: { appointment: { select: { publicCode: true } } },
    });
    return attempt ? {
      status: attempt.status,
      amountCents: attempt.amountCents,
      publicCode: attempt.appointment.publicCode,
    } : null;
  }

  async applyProviderPayment(input: Parameters<DepositPaymentRepository["applyProviderPayment"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.attemptId}))`;
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

      const nextAppointmentStatus = input.status === "APPROVED"
        ? "CONFIRMED"
        : ["EXPIRED", "CANCELLED"].includes(input.status)
          ? "CANCELLED"
          : null;
      if (nextAppointmentStatus && current.appointment.status === "PENDING_CONFIRMATION") {
        await tx.appointment.update({
          where: { id: current.appointmentId },
          data: {
            status: nextAppointmentStatus,
            statusHistory: {
              create: {
                fromStatus: current.appointment.status,
                toStatus: nextAppointmentStatus,
                note: input.status === "APPROVED"
                  ? "Deposit approved by Mercado Pago webhook."
                  : "Deposit attempt expired or was cancelled.",
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
      status: { in: ["CREATED", "PENDING"] },
      expiresAt: { lte: now },
      appointment: { status: "PENDING_CONFIRMATION", paymentAttempts: { none: { status: "APPROVED" } } },
    },
    select: { id: true, appointmentId: true },
  });
  if (overdue.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.depositPaymentAttempt.updateMany({
      where: { id: { in: overdue.map((item) => item.id) } },
      data: { status: "EXPIRED", statusDetail: "Local reservation expiration reached." },
    });
    for (const appointmentId of new Set(overdue.map((item) => item.appointmentId))) {
      const appointment = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { status: true } });
      if (appointment?.status !== "PENDING_CONFIRMATION") continue;
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
    }
  });
  return overdue.length;
}
