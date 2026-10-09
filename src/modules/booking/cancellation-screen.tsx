import Link from "next/link";
import { Alert, Card, DetailList, PageHeading, PageShell, SiteHeader, StatusBadge } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { formatWorkshopDateTime, workshopTime } from "@/src/lib/workshop-date";
import type { getPublicCancellationPreview } from "@/src/modules/booking/service";
import type { DepositPaymentStatus } from "@prisma/client";

export function CancellationScreen({ preview, token, result, refundPolicy, payment, action }: {
  preview: Awaited<ReturnType<typeof getPublicCancellationPreview>>;
  token: string;
  result?: string;
  refundPolicy?: string | null;
  payment?: { status: DepositPaymentStatus; amountCents: number } | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const appointment = preview?.appointment;
  return <>
    <SiteHeader active="booking" linkComponent={Link} />
    <PageShell width="md">
      <PageHeading eyebrow="Tu reserva" title="Cancelar turno" description="Revisá los datos y las condiciones antes de confirmar la cancelación." />
      {result === "cancelled" ? <Alert className="mt-6" tone="success">Tu turno fue cancelado. Si pagaste una seña, comunicate con el taller para consultar su devolución.</Alert> : null}
      {result === "unavailable" || (!preview && result !== "cancelled") ? <Alert className="mt-6" tone="danger">El enlace no es válido o el turno no se puede cancelar online. Comunicate con el taller.</Alert> : null}
      {appointment ? <Card className="mt-6">
        <h2 className="text-xl font-black">El turno que vas a cancelar</h2>
        <div className="mt-3"><StatusBadge status={appointment.status} /></div>
        <DetailList className="mt-4" items={[
          { term: "Código", description: appointment.publicCode },
          { term: "Servicio", description: appointment.serviceName },
          { term: "Fecha y horario", description: `${formatWorkshopDateTime(appointment.startAt, { dateStyle: "long" })}, ${workshopTime(appointment.startAt)} a ${workshopTime(appointment.endAt)}` },
          { term: "Seña", description: cancellationDepositMessage(payment) },
        ]} />
        <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100">
          <p className="font-bold">Condiciones de cancelación y devolución</p>
          <p className="mt-2 whitespace-pre-wrap">{refundPolicy || "El taller todavía no publicó su política de devolución de señas. Consultá las condiciones con el taller antes de cancelar."}</p>
          <p className="mt-2">Cancelar libera el horario. Esta acción no devuelve la seña automáticamente ni reprograma el turno.</p>
        </div>
        {preview?.canCancel && result !== "cancelled" ? <form action={action} className="mt-6">
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <input type="hidden" name="token" value={token} />
          <SubmitButton size="lg" variant="danger" fullWidth>Confirmar cancelación</SubmitButton>
        </form> : <Alert className="mt-5" tone="info">Este turno no se puede cancelar online en su estado actual o según la política del taller. Comunicate con el taller.</Alert>}
        <a className="mt-4 inline-flex min-h-11 items-center font-semibold text-apple-300 underline" href={`/booking/status?code=${encodeURIComponent(appointment.publicCode)}`}>Conservar turno y consultar estado</a>
      </Card> : null}
      <a className="mt-6 inline-flex min-h-11 items-center font-semibold text-apple-300 underline" href="/booking">Volver a turnos</a>
    </PageShell>
  </>;
}

export function cancellationDepositMessage(payment?: { status: DepositPaymentStatus; amountCents: number } | null): string {
  if (!payment) return "No hay una seña registrada para este turno.";
  const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(payment.amountCents / 100);
  if (payment.status === "APPROVED") return `Seña pagada: ${amount}. La devolución debe gestionarse con el taller.`;
  if (payment.status === "REFUNDED") return `Seña devuelta: ${amount}.`;
  if (payment.status === "CHARGED_BACK") return `Seña con contracargo: ${amount}. Consultá con el taller.`;
  if (["PENDING", "CREATED", "ERROR"].includes(payment.status)) return `Pago sin confirmar: ${amount}. Si ya pagaste, consultá con el taller antes de cancelar.`;
  return `No hay un pago aprobado registrado para la seña de ${amount}.`;
}
