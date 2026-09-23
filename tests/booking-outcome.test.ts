import { describe, expect, it } from "vitest";
import { bookingOutcomeQuery, describeBookingOutcome, parseBookingOutcome } from "@/src/modules/booking/booking-outcome";

const pending = { publicCode: "ABCD234567", status: "PENDING_CONFIRMATION" as const };

describe("public booking outcome codes", () => {
  it("round-trips codes through the URL and ignores free text and foreign links", () => {
    const query = bookingOutcomeQuery({ result: "created", code: "ABCD234567", payment: "unavailable", cancel: "/booking/cancel?appointmentId=a&token=t" });
    expect(parseBookingOutcome(Object.fromEntries(query))).toEqual({
      result: "created",
      code: "ABCD234567",
      payment: "unavailable",
      cancel: "/booking/cancel?appointmentId=a&token=t",
    });
    expect(parseBookingOutcome({ message: "Turno confirmado, transferí a este CBU", booked: "1" })).toBeUndefined();
    expect(parseBookingOutcome({ result: "created", cancel: "https://evil.example/booking/cancel?x", payment: "Pagá acá" }))
      .toEqual({ result: "created", code: undefined, payment: undefined, cancel: undefined });
  });

  it("describes success from the stored appointment, not from the link", () => {
    expect(describeBookingOutcome({ result: "created", code: "ABCD234567" }, pending)).toMatchObject({
      accepted: true,
      message: "Recibimos tu pedido de turno y queda pendiente de confirmación del taller.",
      publicCode: "ABCD234567",
    });
    expect(describeBookingOutcome({ result: "created", code: "ABCD234567" }, { ...pending, status: "CONFIRMED" })?.message)
      .toBe("Tu turno quedó confirmado automáticamente.");
    expect(describeBookingOutcome({ result: "created", code: "ZZZZZZZZZZ" }, null)).toBeUndefined();
  });

  it("only offers the cancellation link right after creating the booking", () => {
    const cancel = "/booking/cancel?appointmentId=a&token=t";
    expect(describeBookingOutcome({ result: "created", cancel }, pending)?.cancellationUrl).toBe(cancel);
    expect(describeBookingOutcome({ result: "repeated", cancel }, pending)?.cancellationUrl).toBeUndefined();
  });

  it("marks failures as rejected and explains payment issues", () => {
    expect(describeBookingOutcome({ result: "slot-unavailable" }, null)).toEqual({
      accepted: false,
      message: "Elegí otro horario disponible.",
      paymentError: undefined,
    });
    expect(describeBookingOutcome({ result: "payment-retry", code: "ABCD234567", payment: "disabled" }, pending)).toMatchObject({
      accepted: true,
      message: "El turno sigue registrado, pero no pudimos iniciar la seña.",
      paymentError: "El pago online todavía no está habilitado. El taller coordinará la seña.",
    });
  });
});
