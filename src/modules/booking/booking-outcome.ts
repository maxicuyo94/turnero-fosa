import type { AppointmentStatus } from "@/src/modules/appointments/schemas";

/**
 * Booking outcomes travel in the URL as codes only. The page picks the wording and reads the
 * appointment itself, so a crafted link can never display arbitrary text or a made-up booking.
 */
export const bookingResultCodes = [
  "created",
  "repeated",
  "payment-retry",
  "not-found",
  "slot-unavailable",
  "service-unavailable",
  "invalid",
  "invalid-duration",
] as const;
export type BookingResultCode = (typeof bookingResultCodes)[number];

export const paymentIssueCodes = ["unavailable", "not-payable", "disabled", "not-found"] as const;
export type PaymentIssueCode = (typeof paymentIssueCodes)[number];

const failureMessages: Partial<Record<BookingResultCode, string>> = {
  "not-found": "No encontramos el turno para reintentar el pago.",
  "slot-unavailable": "Elegi otro horario disponible.",
  "service-unavailable": "Elegi un servicio activo.",
  invalid: "Revisa los datos del cliente y del vehiculo.",
  "invalid-duration": "Elegi una duracion valida para el servicio.",
};

const paymentIssueMessages: Record<PaymentIssueCode, string> = {
  unavailable: "El turno fue recibido, pero Mercado Pago no esta disponible. Intenta el pago nuevamente mas tarde.",
  "not-payable": "Este turno ya no admite el pago de una seña.",
  disabled: "El pago online todavia no esta habilitado. El taller coordinara la seña.",
  "not-found": "Revisa el codigo del turno e intenta nuevamente.",
};

export type BookingOutcomeParams = {
  result: BookingResultCode;
  code?: string;
  payment?: PaymentIssueCode;
  cancel?: string;
};

export function bookingOutcomeQuery(params: BookingOutcomeParams): URLSearchParams {
  const query = new URLSearchParams({ result: params.result });
  if (params.code) query.set("code", params.code);
  if (params.payment) query.set("payment", params.payment);
  if (params.cancel) query.set("cancel", params.cancel);
  return query;
}

export function parseBookingOutcome(params: Record<string, string | string[] | undefined>): BookingOutcomeParams | undefined {
  const result = bookingResultCodes.find((code) => code === first(params.result));
  if (!result) return undefined;
  const cancel = first(params.cancel);
  return {
    result,
    code: first(params.code),
    payment: paymentIssueCodes.find((code) => code === first(params.payment)),
    // Only a relative link to the cancellation page is accepted, never an external URL.
    cancel: cancel?.startsWith("/booking/cancel?") ? cancel : undefined,
  };
}

export type BookingOutcome = {
  accepted: boolean;
  message: string;
  publicCode?: string;
  cancellationUrl?: string;
  paymentError?: string;
};

/** Success outcomes are shown only for an appointment that really exists, with its real status. */
export function describeBookingOutcome(
  params: BookingOutcomeParams,
  appointment: { publicCode: string; status: AppointmentStatus } | null,
): BookingOutcome | undefined {
  const failure = failureMessages[params.result];
  if (failure) {
    return {
      accepted: false,
      message: failure,
      paymentError: params.payment ? paymentIssueMessages[params.payment] : undefined,
    };
  }
  if (!appointment) return undefined;

  const paymentError = params.payment ? paymentIssueMessages[params.payment] : undefined;
  return {
    accepted: true,
    message: successMessage(params.result, appointment.status, Boolean(paymentError)),
    publicCode: appointment.publicCode,
    cancellationUrl: params.result === "created" ? params.cancel : undefined,
    paymentError,
  };
}

function successMessage(result: BookingResultCode, status: AppointmentStatus, paymentFailed: boolean): string {
  if (result === "repeated") {
    return "Este pedido de turno ya fue recibido. Usa el mensaje original para acceder al enlace de cancelacion.";
  }
  if (result === "payment-retry") {
    return paymentFailed
      ? "El turno sigue registrado, pero no pudimos iniciar la seña."
      : "Continua en Mercado Pago para confirmar el turno.";
  }
  return status === "CONFIRMED"
    ? "Tu turno quedo confirmado automaticamente."
    : "Recibimos tu pedido de turno y queda pendiente de confirmacion del taller.";
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
