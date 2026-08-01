import { cancelAppointmentAction } from "@/app/(public)/booking/actions";
import { Alert, Button, Card, PageHeading, PageShell } from "@/src/components/ui";

type CancellationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CancellationPage({ searchParams }: CancellationPageProps) {
  const params = (await searchParams) ?? {};
  const appointmentId = stringParam(params.appointmentId) ?? "";
  const token = stringParam(params.token) ?? "";
  const message = stringParam(params.message);

  return (
    <PageShell centered width="md">
      <PageHeading
        description="Podes cancelar este turno online si la politica del taller lo permite. La reprogramacion online no esta disponible por ahora."
        eyebrow="Taller Express"
        title="Cancelar turno"
      />
      {message ? (
        <Alert className="mt-6" tone="success">
          {message}
        </Alert>
      ) : null}
      {appointmentId && token ? (
        <Card className="mt-8" padding="sm">
          <form action={cancelAppointmentAction}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="token" value={token} />
            <Button size="lg" type="submit">
              Confirmar cancelacion
            </Button>
          </form>
        </Card>
      ) : null}
      <a
        className="mt-8 text-sm font-semibold text-apple-300 underline-offset-4 hover:underline"
        href="/booking"
      >
        Volver a turnos
      </a>
    </PageShell>
  );
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
