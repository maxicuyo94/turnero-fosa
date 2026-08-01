import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CodeDisplay,
  DetailList,
  Field,
  PageHeading,
  PageShell,
  SiteHeader,
  StatusBadge,
  TextInput,
} from "@/src/components/ui";
import type { PublicAppointmentStatusResult } from "@/src/modules/booking/service";

type PublicAppointmentStatusScreenProps = {
  code?: string;
  result?: PublicAppointmentStatusResult;
};

export function PublicAppointmentStatusScreen({
  code = "",
  result,
}: PublicAppointmentStatusScreenProps) {
  return (
    <>
      <SiteHeader active="booking" linkComponent={Link} />
      <PageShell width="lg">
        <PageHeading
          description="Ingresa el codigo que recibiste al reservar para ver el estado actual."
          eyebrow="Seguimiento"
          title="Consultar turno"
        />

        <Card className="mt-8" padding="sm">
          <form
            action="/booking/status"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field className="flex-1" label="Codigo del turno">
              <TextInput
                autoComplete="off"
                defaultValue={code}
                maxLength={32}
                mono
                name="code"
                placeholder="ABCD234567"
                required
              />
            </Field>
            <Button size="lg" type="submit">
              Consultar
            </Button>
          </form>
        </Card>

        {result?.accepted ? <AppointmentSummary appointment={result.appointment} /> : null}
        {result && !result.accepted ? (
          <Alert className="mt-6" tone="danger">
            {result.message}
          </Alert>
        ) : null}
      </PageShell>
    </>
  );
}

function AppointmentSummary({
  appointment,
}: {
  appointment: Extract<PublicAppointmentStatusResult, { accepted: true }>["appointment"];
}) {
  const totalDurationMinutes = Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000);
  const durationDescription = totalDurationMinutes > appointment.serviceDurationMinutes
    ? `${totalDurationMinutes} min · Extendido (base ${appointment.serviceDurationMinutes} min)`
    : `${totalDurationMinutes} min`;

  return (
    <Card
      aria-label="Estado del turno"
      className="mt-6 overflow-hidden border-apple-400/30 bg-gradient-to-br from-apple-400/15 to-white/[0.03]"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <CodeDisplay code={appointment.publicCode} label="Codigo" />
        <StatusBadge status={appointment.status} />
      </div>
      <DetailList
        className="pt-5"
        items={[
          { term: "Servicio", description: appointment.serviceName },
          {
            term: "Fecha y horario",
            description: formatAppointmentTime(appointment.startAt, appointment.endAt),
          },
          { term: "Duracion total", description: durationDescription },
        ]}
      />
    </Card>
  );
}

function formatAppointmentTime(startAt: Date, endAt: Date): string {
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Salta" }).format(startAt);
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Salta" });
  return `${date}, ${time.format(startAt)} a ${time.format(endAt)}`;
}
