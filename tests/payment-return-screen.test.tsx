import { render, screen } from "@testing-library/react";
import type { DepositPaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PaymentReturnScreen } from "@/src/modules/booking/payment-return-screen";

const baseAttempt = { amountCents: 500000, publicCode: "ABCD234567", appointmentStatus: "PENDING_CONFIRMATION" as const };
const retryAction = async () => undefined;

describe("PaymentReturnScreen", () => {
  it.each<[DepositPaymentStatus, RegExp]>([
    ["CREATED", /El pago fue iniciado/],
    ["REJECTED", /Mercado Pago rechazó el pago/],
    ["CANCELLED", /El intento de pago fue cancelado/],
    ["EXPIRED", /Este intento de pago venció/],
    ["REFUNDED", /la devolución de esta seña/],
    ["CHARGED_BACK", /un contracargo/],
    ["ERROR", /No pudimos completar o verificar/],
  ])("explains %s and keeps the appointment lookup available", (status, message) => {
    render(<PaymentReturnScreen attempt={{ ...baseAttempt, status }} retryAction={retryAction} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar el turno" })).toHaveAttribute("href", "/booking/status?code=ABCD234567");
  });

  it("does not invite another payment while processing or when verification failed", () => {
    const { rerender } = render(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "PENDING" }} retryAction={retryAction} />);
    expect(screen.getByText(/No vuelvas a pagar mientras esté pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pago/i })).not.toBeInTheDocument();
    rerender(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "ERROR" }} retryAction={retryAction} />);
    expect(screen.queryByRole("button", { name: /pago/i })).not.toBeInTheDocument();
  });

  it("offers a retry for a rejected payment only while the appointment is awaiting confirmation", () => {
    const { rerender } = render(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "REJECTED" }} retryAction={retryAction} />);
    expect(screen.getByRole("button", { name: "Reintentar pago" })).toBeInTheDocument();
    rerender(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "REJECTED", appointmentStatus: "CANCELLED" }} retryAction={retryAction} />);
    expect(screen.queryByRole("button", { name: "Reintentar pago" })).not.toBeInTheDocument();
  });

  it("distinguishes an approved payment from a confirmed appointment", () => {
    const { rerender } = render(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "APPROVED", appointmentStatus: "CONFIRMED" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("La seña fue acreditada y el turno quedó confirmado.");
    rerender(<PaymentReturnScreen attempt={{ ...baseAttempt, status: "APPROVED", appointmentStatus: "CANCELLED" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("La seña fue acreditada, pero el turno no está confirmado.");
  });

  it("gives an explicit recovery path for a missing payment reference", () => {
    render(<PaymentReturnScreen attempt={null} retryAction={retryAction} />);
    expect(screen.getByText(/No encontramos un intento de pago con este enlace/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar el turno" })).toHaveAttribute("href", "/booking/status");
    expect(screen.queryByRole("button", { name: /pago/i })).not.toBeInTheDocument();
  });
});
