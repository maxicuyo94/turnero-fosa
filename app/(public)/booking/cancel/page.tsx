import { cancelAppointmentAction } from "@/app/(public)/booking/actions";
import { Alert, Button, Card, PageHeading, PageShell, type AlertTone } from "@/src/components/ui";

const cancellationOutcomes: Record<string, { tone: AlertTone; message: string } | undefined> = {
  cancelled: { tone: "success", message: "Tu turno fue cancelado." },
  unavailable: {
    tone: "danger",
    message: "Este turno no se puede cancelar online. Puede que ya haya pasado, que ya esté cancelado o que el enlace no sea válido. Comunicate con el taller.",
  },
};

type CancellationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CancellationPage({ searchParams }: CancellationPageProps) {
  const params = (await searchParams) ?? {};
  const appointmentId = stringParam(params.appointmentId) ?? "";
  const token = stringParam(params.token) ?? "";
  const outcome = cancellationOutcomes[stringParam(params.result) ?? ""];

  return (
    <PageShell centered width="md">
      <PageHeading
        description="Podes cancelar este turno online si la politica del taller lo permite. La reprogramacion online no esta disponible por ahora."
        eyebrow="Taller Express"
        title="Cancelar turno"
      />
      {outcome ? (
        <Alert className="mt-6" tone={outcome.tone}>
          {outcome.message}
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
