"use server";

import { redirect } from "next/navigation";
import { bookingRepository, deliverOutboxEmailsAfterResponse, depositCheckout } from "@/src/lib/composition";
import { formOptionalNumber, formOptionalString, formString } from "@/src/lib/form-data";
import { getStaffMember } from "@/src/lib/staff-access";
import { bookingOutcomeQuery, type BookingResultCode, type PaymentIssueCode } from "@/src/modules/booking/booking-outcome";
import { cancelPublicAppointment, createPublicBooking } from "@/src/modules/booking/service";
import { initiateAppointmentDeposit } from "@/src/modules/payments/service";

export async function createAppointmentAction(formData: FormData) {
  // La duración total la define el servicio, salvo que reserve alguien del taller.
  const canEditDuration = (await getStaffMember()) !== null;
  const result = await createPublicBooking(bookingRepository(), {
    serviceId: formString(formData, "serviceId"),
    date: formString(formData, "date"),
    startTime: formString(formData, "startTime"),
    durationMinutes: canEditDuration ? formOptionalNumber(formData, "durationMinutes") : undefined,
    customer: {
      fullName: formString(formData, "fullName"),
      phone: formString(formData, "phone"),
      email: formOptionalString(formData, "email"),
    },
    vehicle: {
      vehicleTypeId: formOptionalString(formData, "vehicleTypeId"),
      brand: formString(formData, "brand"),
      model: formString(formData, "model"),
      licensePlate: formOptionalString(formData, "licensePlate"),
    },
    notes: formOptionalString(formData, "notes"),
    idempotencyKey: formString(formData, "idempotencyKey"),
    now: new Date(),
  });

  if (!result.accepted) {
    const query = bookingOutcomeQuery({ result: bookingFailureCode(result) });
    query.set("serviceId", formString(formData, "serviceId"));
    query.set("date", formString(formData, "date"));
    redirect(`/booking?${query.toString()}`);
  }

  if (!result.repeated) deliverOutboxEmailsAfterResponse();
  const cancellationUrl = result.cancellationToken
    ? `/booking/cancel?appointmentId=${encodeURIComponent(result.appointment.id)}&token=${encodeURIComponent(result.cancellationToken)}`
    : undefined;
  const payment = result.depositRequired ? await startDeposit(result.appointment.id) : undefined;
  redirect(`/booking?${bookingOutcomeQuery({
    result: result.repeated ? "repeated" : "created",
    code: result.appointment.publicCode,
    cancel: cancellationUrl,
    payment,
  }).toString()}`);
}

export async function retryDepositAction(formData: FormData) {
  const publicCode = formString(formData, "publicCode").trim().toUpperCase();
  const appointment = await bookingRepository().findByPublicCode(publicCode);
  if (!appointment) {
    redirect(`/booking?${bookingOutcomeQuery({ result: "not-found", payment: "not-found" }).toString()}`);
  }

  const payment = await startDeposit(appointment.id);
  redirect(`/booking?${bookingOutcomeQuery({ result: "payment-retry", code: appointment.publicCode, payment }).toString()}`);
}

/** Starts or reuses the Mercado Pago checkout; returns the issue code when there is none to offer. */
async function startDeposit(appointmentId: string): Promise<PaymentIssueCode | undefined> {
  const checkout = await depositCheckout();
  if (!checkout) return "disabled";
  const payment = await initiateAppointmentDeposit(checkout.repository, checkout.port, { appointmentId });
  if (payment.accepted) return undefined;
  return payment.reason === "PAYMENT_UNAVAILABLE" ? "unavailable" : payment.reason === "APPOINTMENT_NOT_FOUND" ? "not-found" : "not-payable";
}

function bookingFailureCode(result: Extract<Awaited<ReturnType<typeof createPublicBooking>>, { accepted: false }>): BookingResultCode {
  if (result.reason === "SLOT_UNAVAILABLE") return "slot-unavailable";
  if (result.reason === "SERVICE_UNAVAILABLE") return "service-unavailable";
  return result.fieldErrors?.durationMinutes ? "invalid-duration" : "invalid";
}

export async function cancelAppointmentAction(formData: FormData) {
  const result = await cancelPublicAppointment(bookingRepository(), {
    appointmentId: formString(formData, "appointmentId"),
    token: formString(formData, "token"),
    now: new Date(),
  });

  // The outcome travels as a code so the page picks its own wording and tone.
  redirect(`/booking/cancel?result=${result.accepted ? "cancelled" : "unavailable"}`);
}
