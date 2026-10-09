import Link from "next/link";
import type { AppointmentStatus, DepositPaymentStatus } from "@prisma/client";
import { Alert, Card, PageHeading, PageShell, SiteHeader, type AlertTone } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";

type PublicPaymentAttempt = {
  status: DepositPaymentStatus;
  amountCents: number;
  publicCode: string;
  appointmentStatus: AppointmentStatus;
};

const paymentStates: Record<DepositPaymentStatus, { label: string; tone: AlertTone; message: string }> = {
  CREATED: { label: "iniciada", tone: "info", message: "El pago fue iniciado, pero la seña todavía no está acreditada. Completá el pago para confirmar el turno." },
  PENDING: { label: "pendiente", tone: "info", message: "Mercado Pago todavía está procesando el pago. No vuelvas a pagar mientras esté pendiente; consultá el turno con tu código para comprobar el resultado." },
  APPROVED: { label: "aprobada", tone: "success", message: "La seña fue acreditada y el turno quedó confirmado." },
  REJECTED: { label: "rechazada", tone: "danger", message: "Mercado Pago rechazó el pago. Esta seña no fue acreditada. Consultá el turno para comprobar si todavía podés completar el pago." },
  CANCELLED: { label: "cancelada", tone: "info", message: "El intento de pago fue cancelado y esta seña no fue acreditada. Consultá el turno para comprobar si todavía podés pagarlo." },
  EXPIRED: { label: "vencida", tone: "info", message: "Este intento de pago venció. Consultá el estado del turno antes de hacer una nueva reserva o contactá al taller si ya realizaste un pago." },
  REFUNDED: { label: "devuelta", tone: "info", message: "Mercado Pago informó la devolución de esta seña. Consultá el turno o contactá al taller para coordinar la atención." },
  CHARGED_BACK: { label: "contracargo", tone: "danger", message: "Mercado Pago informó un contracargo de esta seña. Contactá al taller para revisar el pago y la atención de tu turno." },
  ERROR: { label: "con error", tone: "danger", message: "No pudimos completar o verificar este intento de pago. Consultá el estado del turno; si ya pagaste, contactá al taller antes de volver a pagar." },
};

export function PaymentReturnScreen({ attempt, retryAction }: {
  attempt: PublicPaymentAttempt | null;
  retryAction?: (formData: FormData) => void | Promise<void>;
}) {
  const state = attempt ? paymentStates[attempt.status] : null;
  const approvedWithoutConfirmation = attempt?.status === "APPROVED" && !["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(attempt.appointmentStatus);
  const canRetry = attempt?.appointmentStatus === "PENDING_CONFIRMATION" && ["CREATED", "REJECTED", "CANCELLED"].includes(attempt.status);

  return (
    <>
      <SiteHeader active="booking" linkComponent={Link} />
      <PageShell>
        <PageHeading eyebrow="Mercado Pago" title="Estado de la seña" />
        <Card className="mt-8">
          <Alert tone={approvedWithoutConfirmation ? "info" : state?.tone ?? "info"}>
            {approvedWithoutConfirmation
              ? "La seña fue acreditada, pero el turno no está confirmado. Contactá al taller para coordinar la atención o devolución."
              : state?.message ?? "No encontramos un intento de pago con este enlace. Consultá tu turno con el código de la reserva; si ya pagaste, contactá al taller."}
          </Alert>
          {attempt && state ? (
            <p className="mt-5 text-zinc-300">
              Seña: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(attempt.amountCents / 100)} · Estado: {state.label}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {canRetry && retryAction && attempt ? (
              <form action={retryAction}>
                <input name="publicCode" type="hidden" value={attempt.publicCode} />
                <SubmitButton size="md">{attempt.status === "CREATED" ? "Continuar pago" : "Reintentar pago"}</SubmitButton>
              </form>
            ) : null}
            <Link className="inline-flex min-h-11 items-center font-black text-apple-300 underline" href={attempt ? `/booking/status?code=${encodeURIComponent(attempt.publicCode)}` : "/booking/status"}>
              Consultar el turno
            </Link>
          </div>
        </Card>
      </PageShell>
    </>
  );
}
