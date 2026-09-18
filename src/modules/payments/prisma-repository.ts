import type { DepositPaymentStatus, PrismaClient } from "@prisma/client";
import { activeAppointmentStatuses } from "@/src/modules/appointments/schemas";
import { canAcceptAppointment } from "@/src/modules/availability";
import { isDepositActive } from "@/src/modules/settings/business-settings";
import {
  resolveAttemptStatus,
  settledPaymentStatuses,
  type DepositPaymentRepository,
  type DepositReconciler,
} from "@/src/modules/payments/service";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const unpaidStatuses: DepositPaymentStatus[] = ["CREATED", "PENDING", "ERROR", "REJECTED", "CANCELLED", "EXPIRED"];

/** History note that marks a cancellation caused by the deposit deadline, not by a person. */
export const depositExpiredNote = "Deposit reservation expired before approval.";

export class PrismaDepositPaymentRepository implements DepositPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDepositPolicy() {
    const settings = await this.prisma.workshopSettings.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    return {
      required: isDepositActive(settings),
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
    const { now, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      // The same appointment row serializes checkout creation, expiry and webhooks.
      await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${input.appointmentId} FOR UPDATE`;
      const appointment = await tx.appointment.findUnique({ where: { id: input.appointmentId } });
      if (appointment?.status !== "PENDING_CONFIRMATION") return null;
      // Re-read under the lock: a concurrent start may have created the attempt meanwhile.
      const current = await tx.depositPaymentAttempt.findFirst({
        where: { appointmentId: input.appointmentId, status: { in: ["CREATED", "PENDING"] }, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      });
      return current ?? tx.depositPaymentAttempt.create({ data });
    });
  }

  async markPreferenceCreated(input: Parameters<DepositPaymentRepository["markPreferenceCreated"]>[0]) {
    await this.prisma.depositPaymentAttempt.updateMany({
      where: { id: input.attemptId, checkoutUrl: null, status: { in: ["CREATED", "ERROR"] } },
      data: {
        preferenceId: input.preferenceId,
        checkoutUrl: input.checkoutUrl,
        status: "PENDING",
        statusDetail: null,
      },
    });
    return this.prisma.depositPaymentAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
  }

  async markPreferenceFailed(attemptId: string, detail: string) {
    await this.prisma.depositPaymentAttempt.updateMany({
      where: { id: attemptId, checkoutUrl: null, status: "CREATED" },
      data: { status: "ERROR", statusDetail: detail },
    });
  }

  async markAttemptError(attemptId: string, detail: string) {
    // A mismatching notification must not hide money that was already collected.
    await this.prisma.depositPaymentAttempt.updateMany({
      where: { id: attemptId, status: { notIn: [...settledPaymentStatuses] } },
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
      // Reinstating an expired reservation consumes capacity, so approvals queue behind bookings
      // (same lock order as rescheduling: capacity lock first, then the appointment row).
      if (input.status === "APPROVED") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('public_booking_capacity'))`;
      }
      await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${target.appointmentId} FOR UPDATE`;
      const current = await tx.depositPaymentAttempt.findUniqueOrThrow({
        where: { id: input.attemptId },
        include: { appointment: { include: { service: { select: { workshopSettings: { select: { capacity: true } } } } } } },
      });
      const status = resolveAttemptStatus(current.status, input.status);
      const attempt = await tx.depositPaymentAttempt.update({
        where: { id: current.id },
        data: status === input.status
          ? {
              providerPaymentId: input.providerPaymentId,
              status,
              statusDetail: input.statusDetail,
              liveMode: input.liveMode,
              approvedAt: input.approvedAt,
              lastNotificationAt: new Date(),
            }
          // A stale notification is recorded as seen but never rewrites a settled payment.
          : { lastNotificationAt: new Date() },
      });
      if (input.status !== "APPROVED" || status !== "APPROVED") return attempt;

      const appointment = current.appointment;
      // A failed attempt does not cancel other checkouts. Reservation expiry owns
      // cancellation after the last attempt's deadline, leaving time to retry.
      if (appointment.status === "PENDING_CONFIRMATION") {
        await confirmAfterDeposit(tx, appointment.id, appointment.status, "Deposit approved by Mercado Pago webhook.");
        return attempt;
      }

      // A payment can settle after the local deadline (cash vouchers, manual reviews). Undo only the
      // expiry cancellation, and only while the slot is still ahead and still fits the capacity.
      // Anything else stays as is and surfaces in the internal panel as a paid, unconfirmed deposit.
      if (appointment.status === "CANCELLED" && appointment.startAt > new Date()) {
        const lastChange = await tx.appointmentStatusHistory.findFirst({
          where: { appointmentId: appointment.id },
          orderBy: { changedAt: "desc" },
          select: { note: true },
        });
        if (lastChange?.note !== depositExpiredNote) return attempt;

        const overlapping = await tx.appointment.findMany({
          where: {
            id: { not: appointment.id },
            status: { in: [...activeAppointmentStatuses] },
            startAt: { lt: appointment.endAt },
            endAt: { gt: appointment.startAt },
          },
          select: { startAt: true, endAt: true, status: true },
        });
        const fits = canAcceptAppointment({
          settings: { capacity: appointment.service.workshopSettings.capacity },
          startAt: appointment.startAt,
          serviceDurationMinutes: (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000,
          appointments: overlapping,
        }).accepted;
        if (fits) {
          await confirmAfterDeposit(tx, appointment.id, appointment.status, "Deposit approved after the reservation expired; appointment reinstated.");
        }
      }
      return attempt;
    });
  }
}

async function confirmAfterDeposit(
  tx: TransactionClient,
  appointmentId: string,
  fromStatus: "PENDING_CONFIRMATION" | "CANCELLED",
  note: string,
) {
  await tx.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "CONFIRMED",
      statusHistory: { create: { fromStatus, toStatus: "CONFIRMED", note } },
    },
  });
}

/**
 * Approved deposits on cancelled appointments: the workshop has to refund or rebook them. A refund
 * or chargeback notification moves the attempt out of APPROVED and clears it from this list.
 */
export async function listPaidUnconfirmedDeposits(prisma: PrismaClient) {
  const attempts = await prisma.depositPaymentAttempt.findMany({
    where: { status: "APPROVED", appointment: { status: "CANCELLED" } },
    orderBy: { approvedAt: "desc" },
    select: {
      id: true,
      amountCents: true,
      approvedAt: true,
      appointment: {
        select: {
          publicCode: true,
          startAt: true,
          status: true,
          customer: { select: { fullName: true, phone: true } },
        },
      },
    },
  });
  return attempts.map((attempt) => ({
    attemptId: attempt.id,
    amountCents: attempt.amountCents,
    approvedAt: attempt.approvedAt,
    publicCode: attempt.appointment.publicCode,
    startAt: attempt.appointment.startAt,
    appointmentStatus: attempt.appointment.status,
    customerName: attempt.appointment.customer.fullName,
    customerPhone: attempt.appointment.customer.phone,
  }));
}

export type PaidUnconfirmedDeposit = Awaited<ReturnType<typeof listPaidUnconfirmedDeposits>>[number];

/**
 * Cancels reservations whose deposit deadline passed without an approved payment. With `reconcile`,
 * Mercado Pago is asked about each overdue checkout first, so a paid reservation whose notification
 * never arrived is confirmed instead of cancelled; if the provider cannot answer, the reservation
 * is left for the next sweep rather than cancelled blindly.
 */
export async function expireOverdueDepositReservations(
  prisma: PrismaClient,
  now = new Date(),
  options: {
    reconcile?: DepositReconciler;
    /** Builds the reconciler only when something is overdue, keeping the common empty sweep to one query. */
    loadReconciler?: () => Promise<DepositReconciler | undefined>;
  } = {},
): Promise<number> {
  const overdue = await prisma.depositPaymentAttempt.findMany({
    where: {
      status: { in: unpaidStatuses },
      expiresAt: { lte: now },
      appointment: { status: "PENDING_CONFIRMATION", paymentAttempts: { none: { status: "APPROVED" } } },
    },
    select: { id: true, appointmentId: true, externalReference: true },
  });
  if (overdue.length === 0) return 0;

  const reconcile = options.reconcile ?? await options.loadReconciler?.();
  let expiredCount = 0;
  for (const appointmentId of new Set(overdue.map((item) => item.appointmentId))) {
    if (reconcile) {
      try {
        for (const attempt of overdue.filter((item) => item.appointmentId === appointmentId)) {
          await reconcile(attempt.externalReference);
        }
      } catch (error) {
        console.error("deposit reconciliation failed; reservation kept for the next sweep", { appointmentId, error });
        continue;
      }
    }
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
              note: depositExpiredNote,
            },
          },
        },
      });
      return expired.count;
    });
  }
  return expiredCount;
}
