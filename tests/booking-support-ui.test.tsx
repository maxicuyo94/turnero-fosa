import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancellationScreen, cancellationDepositMessage } from "@/src/modules/booking/cancellation-screen";
import { CodeRecoveryForm } from "@/src/modules/booking/code-recovery-form";
import { recoveryResponse, recoverPublicCodes } from "@/src/modules/booking/code-recovery";
import { PublicBookingScreen } from "@/src/modules/booking/public-booking-screen";

const appointment = { id: "appt", publicCode: "TEST234567", serviceId: "oil", serviceName: "Cambio de aceite", serviceDurationMinutes: 30, startAt: new Date("2026-10-12T09:00:00-03:00"), endAt: new Date("2026-10-12T09:30:00-03:00"), status: "CONFIRMED" as const, cancellationToken: null, idempotencyKey: "fixture-key" };

describe("booking support", () => {
  it("shows the next date while retaining service and staff duration", () => {
    render(<PublicBookingScreen services={[{ id: "oil", name: "Aceite", description: null, durationMinutes: 30, isActive: true, displayOrder: 1 }]} selectedServiceId="oil" selectedDate="2026-10-11" selectedDurationMinutes={90} canEditDuration slots={[]} nextAvailability={{ date: "2026-10-12", startTime: "09:00" }} />);
    expect(screen.getByRole("link", { name: /Ver próxima fecha/ })).toHaveAttribute("href", "/booking?serviceId=oil&date=2026-10-12&durationMinutes=90");
    expect(screen.queryByLabelText("Nombre y apellido")).not.toBeInTheDocument();
  });
  it("shows the actual appointment, paid deposit and configured policy before confirming", () => {
    render(<CancellationScreen preview={{ appointment, canCancel: true }} token={"a".repeat(32)} payment={{ status: "APPROVED", amountCents: 500000 }} refundPolicy="Solicitar devolución al taller." action={vi.fn()} />);
    expect(screen.getByText("Cambio de aceite")).toBeInTheDocument();
    expect(screen.getByText(/Seña pagada/)).toBeInTheDocument();
    expect(screen.getByText("Solicitar devolución al taller.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cancelación" })).toBeInTheDocument();
  });
  it("does not expose controls or appointment data for an invalid secret", () => {
    render(<CancellationScreen preview={null} token="invalid" action={vi.fn()} />);
    expect(screen.queryByText(appointment.publicCode)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar cancelación" })).not.toBeInTheDocument();
  });
  it("does not offer cancellation for a blocked appointment", () => {
    render(<CancellationScreen preview={{ appointment, canCancel: false }} token={"a".repeat(32)} action={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Confirmar cancelación" })).not.toBeInTheDocument();
  });
  it("distinguishes unconfirmed and refunded deposits without claiming a refund", () => {
    expect(cancellationDepositMessage({ status: "PENDING", amountCents: 100 })).toContain("Pago sin confirmar");
    expect(cancellationDepositMessage({ status: "REFUNDED", amountCents: 100 })).toContain("Seña devuelta");
    expect(cancellationDepositMessage()).toContain("No hay una seña registrada");
  });
  it("returns a generic recovery message without showing codes in the browser", async () => {
    const action = vi.fn(async () => ({ message: recoveryResponse }));
    render(<CodeRecoveryForm action={action} />);
    fireEvent.change(screen.getByLabelText("Email de la reserva"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar códigos por email" }));
    expect(await screen.findByText(recoveryResponse)).toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByText(appointment.publicCode)).not.toBeInTheDocument();
  });
  it("builds recovery email links for the configured origin and normalized recipient", async () => {
    const queueCodesForEmail = vi.fn(async (email, _now, draft) => {
      expect(email).toBe("person@example.com");
      expect(draft([appointment])).toMatchObject({ event: "PUBLIC_CODE_RECOVERY", recipient: email, text: expect.stringContaining("https://taller.example/booking/status?code=TEST234567") });
      return true;
    });
    await recoverPublicCodes({ queueCodesForEmail }, { email: " Person@Example.com ", now: new Date(), publicOrigin: "https://taller.example" });
    expect(queueCodesForEmail).toHaveBeenCalledOnce();
  });
});
