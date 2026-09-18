import Link from "next/link";
import { db } from "@/src/lib/db";
import { Alert, Card, PageHeading, PageShell, SiteHeader } from "@/src/components/ui";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";
import { getDepositReconciler, reconcileReturnedPayment } from "@/src/modules/payments/reconciliation";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const reference = first(params.reference) ?? first(params.external_reference) ?? "";
  await reconcileOnReturn(first(params.payment_id) ?? first(params.collection_id), reference);
  const attempt = reference
    ? await new PrismaDepositPaymentRepository(db).getPublicAttempt(reference)
    : null;

  return (
    <>
      <SiteHeader active="booking" linkComponent={Link} />
      <PageShell>
        <PageHeading eyebrow="Mercado Pago" title="Estado de la seña" />
        <Card className="mt-8">
          {attempt?.status === "APPROVED" && ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(attempt.appointmentStatus) ? (
            <Alert tone="success">La seña fue acreditada y el turno quedó confirmado.</Alert>
          ) : attempt?.status === "APPROVED" ? (
            <Alert tone="info">La seña fue acreditada, pero el turno no está confirmado. Contactá al taller para coordinar la atención o devolución.</Alert>
          ) : (
            <Alert tone="info">
              Todavía no tenemos la confirmación de Mercado Pago. Si el pago se aprobó, el turno se confirma automáticamente en unos minutos; podés consultarlo con tu código.
            </Alert>
          )}
          {attempt ? (
            <p className="mt-5 text-zinc-300">
              Seña: {formatArs(attempt.amountCents)} · Estado: {paymentLabel(attempt.status)}
            </p>
          ) : null}
          {attempt?.publicCode ? (
            <Link className="mt-5 inline-block font-black text-apple-300 underline" href={`/booking/status?code=${attempt.publicCode}`}>
              Consultar el turno
            </Link>
          ) : null}
        </Card>
      </PageShell>
    </>
  );
}

/**
 * Webhooks stay the primary signal, but test credentials never send them and a real one can be
 * delayed. Asking Mercado Pago here lets the customer see the settled state right away. Failures
 * only mean the page shows the stored state; the webhook or the expiry sweep settles it later.
 */
async function reconcileOnReturn(paymentId: string | undefined, reference: string): Promise<void> {
  try {
    if (paymentId && paymentId !== "null") {
      await reconcileReturnedPayment(db, paymentId);
    } else if (reference) {
      await (await getDepositReconciler(db))?.(reference);
    }
  } catch (error) {
    console.error("payment return reconciliation failed", error);
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatArs(amountCents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountCents / 100);
}

function paymentLabel(status: string): string {
  const labels: Record<string, string> = {
    CREATED: "iniciada",
    PENDING: "pendiente",
    APPROVED: "aprobada",
    REJECTED: "rechazada",
    CANCELLED: "cancelada",
    EXPIRED: "vencida",
    REFUNDED: "devuelta",
    CHARGED_BACK: "contracargo",
    ERROR: "con error",
  };
  return labels[status] ?? "desconocido";
}
