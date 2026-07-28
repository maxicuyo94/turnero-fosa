import { SiteHeader } from "@/src/components/site-header";
import type { AvailableSlot } from "@/src/modules/availability";
import type { PublicServiceRecord } from "@/src/modules/booking/service";

type PublicBookingScreenProps = {
  services: PublicServiceRecord[];
  selectedServiceId: string;
  selectedDate: string;
  slots: AvailableSlot[];
  idempotencyKey?: string;
  action?: (formData: FormData) => void | Promise<void>;
  cancellationBasePath?: string;
  outcome?: { accepted: boolean; message: string; cancellationUrl?: string };
  signedInUserName?: string | null;
};

export function PublicBookingScreen({
  services,
  selectedServiceId,
  selectedDate,
  slots,
  action,
  outcome,
  signedInUserName,
  idempotencyKey = "public-booking-form",
}: PublicBookingScreenProps) {
  const selectedService = services.find((service) => service.id === selectedServiceId);

  return (
    <>
      <SiteHeader active="booking" userName={signedInUserName} />

      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-6 lg:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.55em] text-apple-300">Turnos online</p>
        <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-white">Reservar turno</h1>

      {outcome ? (
        <section className="mt-8 rounded-[1.7rem] border border-apple-400/40 bg-apple-400/10 p-5 text-apple-100" role="status">
          <p>{outcome.message}</p>
          {outcome.cancellationUrl ? (
            <a className="mt-3 inline-block font-semibold underline" href={outcome.cancellationUrl}>
              Guardar enlace de cancelacion
            </a>
          ) : null}
          <p className="mt-3 text-sm text-apple-100/80">La reprogramacion online no esta disponible por ahora.</p>
        </section>
      ) : null}

      <section className="mt-8 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Servicio y fecha</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {selectedService?.name ?? "Selecciona un servicio"} · {selectedService ? `${selectedService.durationMinutes} min` : "Duracion a confirmar"} · {slots.length} horarios
            </p>
          </div>
          <form action="/booking" className="grid gap-3 md:min-w-[30rem] md:grid-cols-[1fr_10rem_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-zinc-400">
              Servicio
              <select className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-apple-300" name="serviceId" defaultValue={selectedServiceId}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-400">
              Fecha
              <input className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-apple-300" name="date" type="date" defaultValue={selectedDate} />
            </label>
            <button className="rounded-lg bg-apple-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-apple-300" type="submit">
              Ver
            </button>
          </form>
        </div>
      </section>

      <form action={action} className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <input type="hidden" name="serviceId" value={selectedServiceId} />
        <input type="hidden" name="date" value={selectedDate} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-2xl font-black text-white">Horarios disponibles</h2>
              <p className="mt-2 text-sm text-zinc-500">Los cupos quedan sujetos a la politica actual del taller.</p>
            </div>
          </div>
          {slots.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {slots.map((slot) => (
                <label key={slot.startTime} className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3 text-zinc-100 transition hover:border-apple-300/60 hover:bg-apple-400/10">
                  <span>
                    <input className="mr-3 accent-apple-400" name="startTime" type="radio" value={slot.startTime} required />
                    <span className="font-black text-white">{slot.startTime}</span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-apple-300">{slot.remainingCapacity} cupos</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-zinc-400">
              No hay horarios disponibles para este servicio y fecha. Proba con otro dia.
            </p>
          )}
        </section>

        <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <h2 className="text-2xl font-black text-white">Datos para el turno</h2>
          <p className="mt-2 text-sm text-zinc-500">Completa tus datos y los de la moto.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-zinc-300">
            Nombre y apellido
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="fullName" required />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Telefono
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="phone" required />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Email
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="email" type="email" />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Marca de la moto
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="brand" required />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Modelo
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="model" required />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Patente
            <input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="licensePlate" />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300 md:col-span-2">
            Comentario o reparacion puntual a revisar
            <textarea className="min-h-24 rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" name="notes" />
          </label>
          </div>

          <button className="mt-6 w-full rounded-lg bg-apple-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-apple-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" type="submit" disabled={slots.length === 0}>
            Solicitar turno
          </button>
        </section>
      </form>
      </main>
    </>
  );
}
