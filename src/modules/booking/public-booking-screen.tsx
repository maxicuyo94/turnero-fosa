import Link from "next/link";
import {
  Alert,
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
import { SubmitButton } from "@/src/components/pending";
import type { AvailableSlot } from "@/src/modules/availability";
import { BookingSearchForm } from "@/src/modules/booking/booking-search-form";
import { BookingCustomerDetails, BookingForm, BookingSelectionSummary } from "@/src/modules/booking/booking-form";
import type { PublicServiceRecord, PublicVehicleTypeRecord } from "@/src/modules/booking/service";

type PublicBookingScreenProps = {
  services: PublicServiceRecord[];
  vehicleTypes?: PublicVehicleTypeRecord[];
  selectedServiceId: string;
  selectedDate: string;
  nextAvailability?: { date: string; startTime: string } | null;
  selectedDurationMinutes: number;
  durationStepMinutes?: number;
  /** La duracion total solo se edita desde una sesion interna. */
  canEditDuration?: boolean;
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
  vehicleTypes = [],
  selectedServiceId,
  selectedDate,
  nextAvailability,
  selectedDurationMinutes,
  durationStepMinutes = 1,
  canEditDuration = false,
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
              className="inline-flex min-h-11 items-center font-semibold text-apple-300 underline decoration-apple-400/40 underline-offset-4"
              href="/booking/status"
            >
              Ya tengo turno
            </a>
          }
          eyebrow="Turnos online"
          title="Reservar turno"
        />

        {outcome ? (
          <Alert className="mt-8" tone={outcome.accepted ? "success" : "danger"}>
            <p>{outcome.message}</p>
            {outcome.publicCode ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-apple-300/30 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <CodeDisplay code={outcome.publicCode} label="Código del turno" />
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
                Guardar enlace de cancelación
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
                    <SubmitButton variant="ghost">Reintentar pago</SubmitButton>
                  </form>
                ) : null}
              </div>
            ) : null}
            {outcome.accepted ? (
              <p className="mt-3 text-sm text-apple-100/80">
                La reprogramación online no está disponible por ahora.
              </p>
            ) : null}
          </Alert>
        ) : null}

        <Card className="mt-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">1 · Elegí el servicio y la fecha</p>
              <h2 className="text-2xl font-black text-white">Servicio y fecha</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {selectedService?.name ?? "Seleccioná un servicio"} ·{" "}
                {selectedService ? `${selectedDurationMinutes} min` : "Duración a confirmar"} ·{" "}
                {slots.length} horarios
              </p>
            </div>
            <BookingSearchForm
              canEditDuration={canEditDuration}
              durationStepMinutes={durationStepMinutes}
              selectedDate={selectedDate}
              selectedDurationMinutes={selectedDurationMinutes}
              selectedServiceId={selectedServiceId}
              services={services}
            />
          </div>
        </Card>

        <BookingForm action={action} date={selectedDate} durationMinutes={selectedDurationMinutes} key={`${selectedServiceId}-${selectedDate}-${selectedDurationMinutes}-${slots.map((slot) => `${slot.startTime}:${slot.remainingCapacity}`).join(",")}`} serviceName={selectedService?.name ?? "Servicio"}>
          <input type="hidden" name="serviceId" value={selectedServiceId} />
          <input type="hidden" name="date" value={selectedDate} />
          {canEditDuration ? (
            <input type="hidden" name="durationMinutes" value={selectedDurationMinutes} />
          ) : null}
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <Card>
            <div className="flex flex-col gap-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">2 · Elegí un horario</p>
                <h2 className="text-2xl font-black text-white">Horarios disponibles</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Disponibilidad para {selectedDate.split("-").reverse().join("/")} · {selectedDurationMinutes} min.
                </p>
              </div>
            </div>
            {slots.length > 0 ? (
              <div className="mt-5 grid gap-5">
                {[{ label: "Mañana", slots: slots.filter((slot) => slot.startTime < "13:00") }, { label: "Tarde", slots: slots.filter((slot) => slot.startTime >= "13:00") }].filter((group) => group.slots.length).map((group) => (
                  <fieldset key={group.label}>
                    <legend className="mb-3 text-sm font-bold text-zinc-300">{group.label}</legend>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {group.slots.map((slot) => (
                        <SlotOption
                          className="flex-col items-start gap-1 px-3 py-3 text-sm [&_input]:mr-2 [&_span]:text-left"
                          key={slot.startTime}
                          remainingCapacity={slot.remainingCapacity}
                          required
                          startTime={slot.startTime}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : (
              <EmptyState className="mt-5">
                <p>No hay horarios disponibles para este servicio y fecha.</p>
                {nextAvailability ? (
                  <a className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-apple-400 px-4 py-3 font-bold text-zinc-950" href={`/booking?${new URLSearchParams({ serviceId: selectedServiceId, date: nextAvailability.date, ...(canEditDuration ? { durationMinutes: String(selectedDurationMinutes) } : {}) })}`}>
                    Ver próxima fecha: {nextAvailability.date.split("-").reverse().join("/")} desde las {nextAvailability.startTime}
                  </a>
                ) : <p className="mt-3">No encontramos otra fecha disponible dentro del período de reservas. Consultá con el taller o probá otro servicio.</p>}
                <a className="mt-3 inline-flex min-h-11 items-center font-bold text-apple-300 underline" href="#buscar-horarios">Cambiar servicio o fecha</a>
              </EmptyState>
            )}
          </Card>

          {slots.length > 0 ? <Card>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">3 · Completá y confirmá</p>
            <h2 className="text-2xl font-black text-white">Datos para el turno</h2>
            <BookingCustomerDetails>
              <p className="mt-2 text-sm text-zinc-400">Completá tus datos y los del vehículo.</p>
              {depositPolicy?.required ? (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100">
                  Para confirmar el turno se solicita una seña de <strong>{formatArs(depositPolicy.amountCents)}</strong>.
                  La reserva queda disponible durante {depositPolicy.expirationMinutes} minutos para completar el pago en Mercado Pago.
                </div>
              ) : null}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Nombre y apellido">
                  <TextInput autoComplete="name" maxLength={120} name="fullName" required />
                </Field>
                <Field label="Teléfono">
                  <TextInput autoComplete="tel" inputMode="tel" maxLength={40} name="phone" required type="tel" />
                </Field>
                <Field hint="opcional" label="Email">
                  <TextInput autoComplete="email" maxLength={254} name="email" type="email" />
                </Field>
                {vehicleTypes.length > 1 ? (
                  <Field label="Tipo de vehículo">
                    <Select name="vehicleTypeId" required>
                      {vehicleTypes.map((vehicleType) => (
                        <option key={vehicleType.id} value={vehicleType.id}>
                          {vehicleType.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {/* Con un unico tipo configurado el selector solo agregaria ruido, pero el dato se envia igual. */}
                {vehicleTypes.length === 1 ? <input name="vehicleTypeId" type="hidden" value={vehicleTypes[0].id} /> : null}
                <Field label="Marca">
                  <TextInput maxLength={60} name="brand" required />
                </Field>
                <Field label="Modelo">
                  <TextInput maxLength={60} name="model" required />
                </Field>
                <Field hint="opcional" label="Patente">
                  <TextInput autoCapitalize="characters" maxLength={20} name="licensePlate" />
                </Field>
                <Field className="md:col-span-2" hint="opcional" label="Comentario o reparación puntual a revisar">
                  <Textarea maxLength={1000} name="notes" />
                </Field>
              </div>

              <BookingSelectionSummary />
              <SubmitButton className="mt-6" fullWidth size="md">
                {depositPolicy?.required ? "Reservar y pagar seña" : "Solicitar turno"}
              </SubmitButton>
            </BookingCustomerDetails>
          </Card> : null}
        </BookingForm>
      </PageShell>
    </>
  );
}

function formatArs(amountCents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountCents / 100);
}
