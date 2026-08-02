import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateMercadoPagoSignature } from "@/src/modules/payments/mercado-pago-adapter";
import {
  initiateAppointmentDeposit,
  processMercadoPagoPayment,
  type DepositPaymentAttemptRecord,
  type DepositPaymentRepository,
  type MercadoPagoPort,
} from "@/src/modules/payments/service";

describe("Mercado Pago deposit flow", () => {
  it("creates one hosted checkout preference and reuses it while it remains valid", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const now = new Date("2026-08-02T12:00:00-03:00");

    const first = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1", now });
    const repeated = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1", now });

    expect(first).toMatchObject({ accepted: true, required: true, amountCents: 500_000 });
    expect(repeated).toEqual(first);
    expect(port.preferences).toHaveLength(1);
    expect(repository.attempts).toHaveLength(1);
  });

  it("does not create a checkout for an appointment that is no longer pending", async () => {
    const repository = new InMemoryPaymentRepository();
    repository.appointmentStatus = "CANCELLED";
    const port = new InMemoryMercadoPagoPort();

    await expect(initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" })).resolves.toEqual({
      accepted: false,
      reason: "APPOINTMENT_NOT_PAYABLE",
      message: "Este turno ya no admite el pago de una seña.",
    });
    expect(port.preferences).toHaveLength(0);
  });

  it("confirms through provider data and keeps duplicate webhooks idempotent", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const initiated = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" });
    if (!initiated.accepted || !initiated.required) throw new Error("Expected a deposit checkout");
    port.payment = {
      id: "payment-1",
      externalReference: initiated.reference,
      amount: 5_000,
      currency: "ARS",
      status: "approved",
      statusDetail: "accredited",
      liveMode: false,
      approvedAt: new Date("2026-08-02T15:10:00Z"),
    };

    const first = await processMercadoPagoPayment(repository, port, { paymentId: "payment-1", expectedLiveMode: false });
    const duplicate = await processMercadoPagoPayment(repository, port, { paymentId: "payment-1", expectedLiveMode: false });

    expect(first).toEqual({ accepted: true, status: "APPROVED" });
    expect(duplicate).toEqual(first);
    expect(repository.approvalTransitions).toBe(1);
  });

  it("rejects provider data whose amount, currency, or live mode does not match", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const initiated = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" });
    if (!initiated.accepted || !initiated.required) throw new Error("Expected a deposit checkout");
    port.payment = {
      id: "payment-2",
      externalReference: initiated.reference,
      amount: 1,
      currency: "ARS",
      status: "approved",
      statusDetail: null,
      liveMode: true,
      approvedAt: new Date(),
    };

    await expect(processMercadoPagoPayment(repository, port, { paymentId: "payment-2", expectedLiveMode: false }))
      .resolves.toEqual({ accepted: false, reason: "PAYMENT_MISMATCH" });
    expect(repository.attempts[0]?.status).toBe("ERROR");
    expect(repository.approvalTransitions).toBe(0);
  });
});

describe("Mercado Pago webhook signature", () => {
  it("validates the signed manifest and rejects stale or changed notifications", () => {
    const secret = "webhook-secret";
    const timestamp = 1_785_690_000;
    const manifest = `id:12345;request-id:req-1;ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    const input = {
      xSignature: `ts=${timestamp},v1=${signature}`,
      xRequestId: "req-1",
      dataId: "12345",
      secret,
      nowSeconds: timestamp + 30,
    };

    expect(validateMercadoPagoSignature(input)).toBe(true);
    expect(validateMercadoPagoSignature({ ...input, dataId: "other" })).toBe(false);
    expect(validateMercadoPagoSignature({ ...input, nowSeconds: timestamp + 301 })).toBe(false);
  });
});

class InMemoryPaymentRepository implements DepositPaymentRepository {
  attempts: DepositPaymentAttemptRecord[] = [];
  approvalTransitions = 0;
  appointmentStatus: "PENDING_CONFIRMATION" | "CANCELLED" = "PENDING_CONFIRMATION";

  async getDepositPolicy() {
    return { required: true, amountCents: 500_000, expirationMinutes: 30 };
  }

  async findAppointmentForDeposit(appointmentId: string) {
    return appointmentId === "appt_1" ? {
      id: "appt_1",
      publicCode: "ABCD234567",
      serviceName: "Service Esencial",
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      status: this.appointmentStatus,
    } : null;
  }

  async findReusableAttempt(appointmentId: string, now: Date) {
    return this.attempts.find((attempt) =>
      attempt.appointmentId === appointmentId &&
      ["CREATED", "PENDING"].includes(attempt.status) &&
      attempt.expiresAt > now,
    ) ?? null;
  }

  async createAttempt(input: Parameters<DepositPaymentRepository["createAttempt"]>[0]) {
    const attempt: DepositPaymentAttemptRecord = {
      id: `attempt-${this.attempts.length + 1}`,
      ...input,
      preferenceId: null,
      providerPaymentId: null,
      checkoutUrl: null,
      currency: "ARS",
      status: "CREATED",
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async markPreferenceCreated(input: Parameters<DepositPaymentRepository["markPreferenceCreated"]>[0]) {
    const attempt = this.requiredAttempt(input.attemptId);
    attempt.preferenceId = input.preferenceId;
    attempt.checkoutUrl = input.checkoutUrl;
    attempt.status = "PENDING";
    return attempt;
  }

  async markAttemptError(attemptId: string) {
    this.requiredAttempt(attemptId).status = "ERROR";
  }

  async findByExternalReference(externalReference: string) {
    return this.attempts.find((attempt) => attempt.externalReference === externalReference) ?? null;
  }

  async applyProviderPayment(input: Parameters<DepositPaymentRepository["applyProviderPayment"]>[0]) {
    const attempt = this.requiredAttempt(input.attemptId);
    if (input.status === "APPROVED" && attempt.status !== "APPROVED") this.approvalTransitions += 1;
    attempt.providerPaymentId = input.providerPaymentId;
    attempt.status = input.status;
    return attempt;
  }

  private requiredAttempt(id: string) {
    const attempt = this.attempts.find((item) => item.id === id);
    if (!attempt) throw new Error("Attempt not found");
    return attempt;
  }
}

class InMemoryMercadoPagoPort implements MercadoPagoPort {
  preferences: Parameters<MercadoPagoPort["createPreference"]>[0][] = [];
  payment: Awaited<ReturnType<MercadoPagoPort["getPayment"]>> | null = null;

  async createPreference(input: Parameters<MercadoPagoPort["createPreference"]>[0]) {
    this.preferences.push(input);
    return { preferenceId: "preference-1", checkoutUrl: "https://sandbox.mercadopago.com/checkout" };
  }

  async getPayment() {
    if (!this.payment) throw new Error("Payment not configured");
    return this.payment;
  }
}
