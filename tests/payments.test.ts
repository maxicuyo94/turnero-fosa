import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoAdapter, validateMercadoPagoSignature } from "@/src/modules/payments/mercado-pago-adapter";
import {
  initiateAppointmentDeposit,
  processMercadoPagoPayment,
  reconcileDepositAttempt,
  resolveAttemptStatus,
  settledPaymentStatuses,
  type DepositPaymentAttemptRecord,
  type DepositPaymentRepository,
  type MercadoPagoPort,
  type ProviderPayment,
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

  it("gives concurrent starts a single attempt and a single payable checkout", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const now = new Date("2026-08-02T12:00:00-03:00");

    const [first, second] = await Promise.all([
      initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1", now }),
      initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1", now }),
    ]);

    expect(repository.attempts).toHaveLength(1);
    expect(first).toMatchObject({ accepted: true, required: true });
    expect(second).toEqual(first);
    // Any extra provider call reuses the same external reference, which is also the idempotency key.
    expect(new Set(port.preferences.map((item) => item.externalReference)).size).toBe(1);
  });

  it("keeps a stored checkout when a concurrent preference request fails", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const stored = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" });
    await repository.markPreferenceFailed(repository.attempts[0]!.id);

    expect(repository.attempts[0]).toMatchObject({ status: "PENDING", checkoutUrl: stored.accepted && stored.required ? stored.checkoutUrl : "" });
  });

  it("reports a provider outage without creating a second checkout on retry", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    port.failPreference = true;
    await expect(initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" })).resolves.toMatchObject({
      accepted: false,
      reason: "PAYMENT_UNAVAILABLE",
    });
    expect(repository.attempts[0]?.status).toBe("ERROR");
  });

  it.each([
    ["an approval followed by a newer rejection", ["rejected", "approved"]],
    ["a rejection followed by an approval", ["approved", "rejected"]],
  ])("reconciles %s into an approved deposit without a webhook", async (_label, newestFirst) => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const initiated = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" });
    if (!initiated.accepted || !initiated.required) throw new Error("Expected a deposit checkout");
    port.searchable = newestFirst.map((status, index) => providerPayment(`payment-${index}`, initiated.reference, status));

    await expect(reconcileDepositAttempt(repository, port, { externalReference: initiated.reference, expectedLiveMode: false }))
      .resolves.toBe("APPROVED");
    expect(repository.attempts[0]?.status).toBe("APPROVED");
  });

  it("leaves an attempt untouched when Mercado Pago has no payment for it", async () => {
    const repository = new InMemoryPaymentRepository();
    const port = new InMemoryMercadoPagoPort();
    const initiated = await initiateAppointmentDeposit(repository, port, { appointmentId: "appt_1" });
    if (!initiated.accepted || !initiated.required) throw new Error("Expected a deposit checkout");

    await expect(reconcileDepositAttempt(repository, port, { externalReference: initiated.reference })).resolves.toBeNull();
    expect(repository.attempts[0]?.status).toBe("PENDING");
  });
});

describe("Mercado Pago checkout preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers only instant payment methods and sends an idempotency key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout", sandbox_init_point: "https://sandbox/checkout" })));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new MercadoPagoAdapter({
      MERCADO_PAGO_ACCESS_TOKEN: "token",
      MERCADO_PAGO_WEBHOOK_SECRET: "secret",
      MERCADO_PAGO_ENVIRONMENT: "test",
      NEXT_PUBLIC_APP_URL: "https://turnos.example",
    });

    await adapter.createPreference({
      externalReference: "deposit:abc",
      title: "Seña",
      amountCents: 500_000,
      payerEmail: null,
      expiresAt: new Date("2026-08-02T15:30:00Z"),
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      binary_mode: true,
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
      external_reference: "deposit:abc",
      expires: true,
    });
    expect((init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("deposit:abc");
  });
});

describe("Mercado Pago webhook signature", () => {
  it("never lets a late or out-of-order notification undo a settled deposit", () => {
    expect(resolveAttemptStatus("PENDING", "REJECTED")).toBe("REJECTED");
    expect(resolveAttemptStatus("REJECTED", "APPROVED")).toBe("APPROVED");
    expect(resolveAttemptStatus("APPROVED", "PENDING")).toBe("APPROVED");
    expect(resolveAttemptStatus("APPROVED", "REJECTED")).toBe("APPROVED");
    expect(resolveAttemptStatus("APPROVED", "ERROR")).toBe("APPROVED");
    expect(resolveAttemptStatus("APPROVED", "REFUNDED")).toBe("REFUNDED");
    expect(resolveAttemptStatus("APPROVED", "CHARGED_BACK")).toBe("CHARGED_BACK");
    expect(resolveAttemptStatus("REFUNDED", "APPROVED")).toBe("REFUNDED");
    expect(resolveAttemptStatus("CHARGED_BACK", "PENDING")).toBe("CHARGED_BACK");
  });

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

  it("accepts timestamps in milliseconds, as the current documentation describes them", () => {
    const secret = "webhook-secret";
    const timestampMs = 1_785_690_000_123;
    const manifest = `id:abc123;request-id:req-1;ts:${timestampMs};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    const input = { xSignature: `ts=${timestampMs},v1=${signature}`, xRequestId: "req-1", dataId: "ABC123", secret, nowSeconds: 1_785_690_030 };

    expect(validateMercadoPagoSignature(input)).toBe(true);
    expect(validateMercadoPagoSignature({ ...input, nowSeconds: 1_785_690_400 })).toBe(false);
  });

  it("leaves missing values out of the manifest instead of rejecting the notification", () => {
    const secret = "webhook-secret";
    const timestamp = 1_785_690_000;
    const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

    expect(validateMercadoPagoSignature({
      xSignature: `ts=${timestamp},v1=${sign(`id:12345;ts:${timestamp};`)}`,
      xRequestId: null, dataId: "12345", secret, nowSeconds: timestamp,
    })).toBe(true);
    expect(validateMercadoPagoSignature({
      xSignature: `ts=${timestamp},v1=${sign(`request-id:req-1;ts:${timestamp};`)}`,
      xRequestId: "req-1", dataId: null, secret, nowSeconds: timestamp,
    })).toBe(true);
    expect(validateMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "12345", secret, nowSeconds: timestamp })).toBe(false);
  });
});

function providerPayment(id: string, externalReference: string, status: string): ProviderPayment {
  return {
    id,
    externalReference,
    amount: 5_000,
    currency: "ARS",
    status,
    statusDetail: null,
    liveMode: false,
    approvedAt: status === "approved" ? new Date("2026-08-02T15:10:00Z") : null,
  };
}

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
    return this.reusableAttempt(appointmentId, now);
  }

  /** Mirrors the row lock: the lookup and the insert happen without yielding in between. */
  async createAttempt(input: Parameters<DepositPaymentRepository["createAttempt"]>[0]) {
    const { now, ...data } = input;
    const current = this.reusableAttempt(data.appointmentId, now);
    if (current) return current;
    const attempt: DepositPaymentAttemptRecord = {
      id: `attempt-${this.attempts.length + 1}`,
      ...data,
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
    if (attempt.checkoutUrl === null && ["CREATED", "ERROR"].includes(attempt.status)) {
      attempt.preferenceId = input.preferenceId;
      attempt.checkoutUrl = input.checkoutUrl;
      attempt.status = "PENDING";
    }
    return attempt;
  }

  async markPreferenceFailed(attemptId: string) {
    const attempt = this.requiredAttempt(attemptId);
    if (attempt.checkoutUrl === null && attempt.status === "CREATED") attempt.status = "ERROR";
  }

  async markAttemptError(attemptId: string) {
    const attempt = this.requiredAttempt(attemptId);
    if (!settledPaymentStatuses.includes(attempt.status)) attempt.status = "ERROR";
  }

  async findByExternalReference(externalReference: string) {
    return this.attempts.find((attempt) => attempt.externalReference === externalReference) ?? null;
  }

  async applyProviderPayment(input: Parameters<DepositPaymentRepository["applyProviderPayment"]>[0]) {
    const attempt = this.requiredAttempt(input.attemptId);
    if (input.status === "APPROVED" && attempt.status !== "APPROVED") this.approvalTransitions += 1;
    const status = resolveAttemptStatus(attempt.status, input.status);
    if (status === input.status) {
      attempt.providerPaymentId = input.providerPaymentId;
      attempt.status = status;
    }
    return attempt;
  }

  private reusableAttempt(appointmentId: string, now: Date) {
    return this.attempts.find((attempt) =>
      attempt.appointmentId === appointmentId &&
      ["CREATED", "PENDING"].includes(attempt.status) &&
      attempt.expiresAt > now,
    ) ?? null;
  }

  private requiredAttempt(id: string) {
    const attempt = this.attempts.find((item) => item.id === id);
    if (!attempt) throw new Error("Attempt not found");
    return attempt;
  }
}

class InMemoryMercadoPagoPort implements MercadoPagoPort {
  preferences: Parameters<MercadoPagoPort["createPreference"]>[0][] = [];
  payment: ProviderPayment | null = null;
  /** Payments visible to a search, newest first, as Mercado Pago returns them. */
  searchable: ProviderPayment[] = [];
  failPreference = false;

  async createPreference(input: Parameters<MercadoPagoPort["createPreference"]>[0]) {
    this.preferences.push(input);
    if (this.failPreference) throw new Error("Mercado Pago API returned 503.");
    return { preferenceId: `preference-${this.preferences.length}`, checkoutUrl: `https://sandbox.mercadopago.com/checkout/${this.preferences.length}` };
  }

  async getPayment() {
    if (!this.payment) throw new Error("Payment not configured");
    return this.payment;
  }

  async searchPayments(externalReference: string) {
    return this.searchable.filter((payment) => payment.externalReference === externalReference);
  }
}
