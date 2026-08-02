import Link from "next/link";
import { db } from "@/src/lib/db";
import { Alert, Card, PageHeading, PageShell, SiteHeader } from "@/src/components/ui";
import { PrismaDepositPaymentRepository } from "@/src/modules/payments/prisma-repository";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const reference = first(params.reference) ?? first(params.external_reference) ?? "";
  const attempt = reference
    ? await new PrismaDepositPaymentRepository(db).getPublicAttempt(reference)
    : null;

  return (
    <>
      <SiteHeader active="booking" linkComponent={Link} />
      <PageShell>
        <PageHeading eyebrow="Mercado Pago" title="Estado de la seña" />
        <Card className="mt-8">
          {attempt?.status === "APPROVED" ? (
            <Alert tone="success">La seña fue acreditada y el turno quedó confirmado.</Alert>
          ) : (
            <Alert tone="info">
              Estamos verificando el pago con Mercado Pago. La confirmación depende del webhook seguro, no de esta página de retorno.
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
