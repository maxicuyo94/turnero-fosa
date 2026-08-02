import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CodeDisplay,
  EmptyState,
  Field,
  PageHeading,
  PageShell,
  Select,
  SiteHeader,
  SlotOption,
  Textarea,
  TextInput,
} from "@/src/components/ui";
import type { AvailableSlot } from "@/src/modules/availability";
import type { PublicServiceRecord } from "@/src/modules/booking/service";

type PublicBookingScreenProps = {
  services: PublicServiceRecord[];
  selectedServiceId: string;
  selectedDate: string;
  selectedDurationMinutes: number;
  durationStepMinutes?: number;
  slots: AvailableSlot[];
  idempotencyKey?: string;
  action?: (formData: FormData) => void | Promise<void>;
  paymentAction?: (formData: FormData) => void | Promise<void>;
  cancellationBasePath?: string;
  depositPolicy?: { required: boolean; amountCents: number; expirationMinutes: number };
  outcome?: {
    accepted: boolean;
    message: string;
    cancellationUrl?: string;
    publicCode?: string;
    paymentUrl?: string;
    paymentError?: string;
    depositAmountCents?: number;
  };
  signedInUserName?: string | null;
};

export function PublicBookingScreen({
  services,
  selectedServiceId,
  selectedDate,
  selectedDurationMinutes,
  durationStepMinutes = 1,
  slots,
  action,
  paymentAction,
  outcome,
  depositPolicy,
  signedInUserName,
  idempotencyKey = "public-booking-form",
}: PublicBookingScreenProps) {
  const selectedService = services.find((service) => service.id === selectedServiceId);

  return (
    <>
      <SiteHeader active="booking" linkComponent={Link} userName={signedInUserName} />

      <PageShell>
        <PageHeading
          action={
            <a
              className="font-semibold text-apple-300 underline decoration-apple-400/40 underline-offset-4"
              href="/booking/status"
            >
              Ya tengo turno
            </a>
          }
          eyebrow="Turnos online"
          title="Reservar turno"
        />

        {outcome ? (
          <Alert className="mt-8" tone="success">
            <p>{outcome.message}</p>
            {outcome.publicCode ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-apple-300/30 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <CodeDisplay code={outcome.publicCode} label="Codigo del turno" />
                <a
                  className="font-black text-apple-200 underline underline-offset-4"
                  href={`/booking/status?code=${encodeURIComponent(outcome.publicCode)}`}
                >
                  Consultar estado
                </a>
              </div>
            ) : null}
            {outcome.cancellationUrl ? (
              <a className="mt-3 inline-block font-semibold underline" href={outcome.cancellationUrl}>
                Guardar enlace de cancelacion
              </a>
            ) : null}
            {outcome.paymentUrl ? (
              <a
                className="mt-4 inline-flex rounded-xl bg-apple-400 px-5 py-3 font-black text-zinc-950"
                href={outcome.paymentUrl}
              >
                Pagar seña de {formatArs(outcome.depositAmountCents ?? depositPolicy?.amountCents ?? 0)}
              </a>
            ) : null}
            {outcome.paymentError ? (
              <div className="mt-4">
                <p className="text-sm text-amber-200">{outcome.paymentError}</p>
                {paymentAction && outcome.publicCode ? (
                  <form action={paymentAction} className="mt-3">
                    <input name="publicCode" type="hidden" value={outcome.publicCode} />
                    <Button type="submit" variant="ghost">Reintentar pago</Button>
                  </form>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-apple-100/80">
              La reprogramacion online no esta disponible por ahora.
            </p>
          </Alert>
        ) : null}

        <Card className="mt-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Servicio y fecha</h2>
              <p className="mt-2 text-sm text-zinc-500">
                {selectedService?.name ?? "Selecciona un servicio"} ·{" "}
                {selectedService ? `${selectedDurationMinutes} min` : "Duracion a confirmar"} ·{" "}
                {slots.length} horarios
              </p>
            </div>
            <form
              action="/booking"
              className="grid gap-3 md:min-w-[38rem] md:grid-cols-[1fr_9rem_9rem_auto] md:items-end"
            >
              <Field label="Servicio">
                <Select defaultValue={selectedServiceId} density="sm" name="serviceId">
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {service.durationMinutes} min
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha">
                <TextInput defaultValue={selectedDate} density="sm" name="date" type="date" />
              </Field>
              <Field hint={selectedService ? `(min. ${selectedService.durationMinutes})` : undefined} label="Duracion total">
                <TextInput
                  defaultValue={selectedDurationMinutes}
                  density="sm"
                  min={selectedService?.durationMinutes}
                  name="durationMinutes"
                  step={durationStepMinutes}
                  type="number"
                />
              </Field>
              <Button type="submit">Ver</Button>
            </form>
          </div>
        </Card>

        <form action={action} className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <input type="hidden" name="serviceId" value={selectedServiceId} />
          <input type="hidden" name="date" value={selectedDate} />
          <input type="hidden" name="durationMinutes" value={selectedDurationMinutes} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <Card>
            <div className="flex flex-col gap-2">
              <div>
                <h2 className="text-2xl font-black text-white">Horarios disponibles</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Los cupos quedan sujetos a la politica actual del taller.
                </p>
              </div>
            </div>
            {slots.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {slots.map((slot) => (
                  <SlotOption
                    key={slot.startTime}
                    remainingCapacity={slot.remainingCapacity}
                    required
                    startTime={slot.startTime}
                  />
                ))}
              </div>
            ) : (
              <EmptyState className="mt-5">
                No hay horarios disponibles para este servicio y fecha. Proba con otro dia.
              </EmptyState>
            )}
          </Card>

          <Card>
            <h2 className="text-2xl font-black text-white">Datos para el turno</h2>
            <p className="mt-2 text-sm text-zinc-500">Completa tus datos y los de la moto.</p>
            {depositPolicy?.required ? (
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100">
                Para confirmar el turno se solicita una seña de <strong>{formatArs(depositPolicy.amountCents)}</strong>.
                La reserva queda disponible durante {depositPolicy.expirationMinutes} minutos para completar el pago en Mercado Pago.
              </div>
            ) : null}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Nombre y apellido">
                <TextInput name="fullName" required />
              </Field>
              <Field label="Telefono">
                <TextInput name="phone" required />
              </Field>
              <Field label="Email">
                <TextInput name="email" type="email" />
              </Field>
              <Field label="Marca de la moto">
                <TextInput name="brand" required />
              </Field>
              <Field label="Modelo">
                <TextInput name="model" required />
              </Field>
              <Field label="Patente">
                <TextInput name="licensePlate" />
              </Field>
              <Field className="md:col-span-2" label="Comentario o reparacion puntual a revisar">
                <Textarea name="notes" />
              </Field>
            </div>

            <Button className="mt-6" disabled={slots.length === 0} fullWidth size="md" type="submit">
              {depositPolicy?.required ? "Reservar y pagar seña" : "Solicitar turno"}
            </Button>
          </Card>
        </form>
      </PageShell>
    </>
  );
}

function formatArs(amountCents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountCents / 100);
}
