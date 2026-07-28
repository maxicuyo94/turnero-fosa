import { signOutAction, updateAppointmentStatusAction } from "@/app/(internal)/internal/actions";
import { updateServiceVisibilityAction, updateWorkshopSettingsAction } from "@/app/(internal)/internal/actions";
import { SiteHeader } from "@/src/components/site-header";
import type { InternalServiceRecord, InternalWorkshopSettingsRecord } from "@/src/modules/internal/maintenance";
import { internalStatusOptions, statusLabel, type InternalAgenda } from "@/src/modules/internal/operations";

export function InternalAgendaScreen({
  agenda,
  settings,
  services = [],
  signedInUserName,
}: {
  agenda: InternalAgenda;
  settings?: InternalWorkshopSettingsRecord;
  services?: InternalServiceRecord[];
  signedInUserName?: string | null;
}) {
  return (
    <>
      <SiteHeader active="internal" onSignOut={signOutAction} userName={signedInUserName} />

      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-6 lg:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.55em] text-apple-300">Gestion del taller</p>
        <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-white">Agenda</h1>

        <section className="mt-8 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Turnos del dia</h2>
              <p className="mt-2 text-sm text-zinc-500">{formatDisplayDate(agenda.date)} · {agenda.appointments.length} Turnos</p>
            </div>
            <form action="/internal" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="grid gap-2 text-sm font-medium text-zinc-400">
                Fecha
                <input className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-apple-300" defaultValue={agenda.date} name="date" type="date" />
              </label>
              <button className="rounded-lg bg-apple-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-apple-300" type="submit">
                Ver
              </button>
            </form>
          </div>

          {agenda.appointments.length === 0 ? (
            <section className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-zinc-400">
              No hay turnos agendados para esta fecha.
            </section>
          ) : (
            <div className="mt-6 grid gap-4">
              {agenda.appointments.map((appointment) => (
                <article key={appointment.id} className="rounded-2xl border border-white/10 bg-charcoal-950 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-apple-300">
                        {formatTime(appointment.startAt)}-{formatTime(appointment.endAt)} · {statusLabel(appointment.status)}
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">{appointment.customerName}</h3>
                      <p className="mt-1 text-sm text-zinc-300">{appointment.serviceName}</p>
                      <p className="text-sm text-zinc-500">{appointment.motorcycleLabel} · {appointment.customerPhone}</p>
                      {appointment.notes ? <p className="mt-3 text-sm text-zinc-300">{appointment.notes}</p> : null}
                    </div>
                    <form action={updateAppointmentStatusAction} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:min-w-52">
                      <input name="appointmentId" type="hidden" value={appointment.id} />
                      <input name="date" type="hidden" value={agenda.date} />
                      <label className="text-sm font-medium text-zinc-300" htmlFor={`status-${appointment.id}`}>Estado</label>
                      <select className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none" defaultValue={appointment.status} id={`status-${appointment.id}`} name="nextStatus">
                        {internalStatusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                      <button className="rounded-xl bg-apple-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-apple-300" type="submit">Actualizar</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          {settings ? (
            <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
              <h2 className="text-2xl font-black text-white">Configuracion del taller</h2>
              <form action={updateWorkshopSettingsAction} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-zinc-300">Capacidad simultanea <span className="text-zinc-500">(1-20)</span><input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" defaultValue={settings.capacity} name="capacity" type="number" /></label>
                <label className="grid gap-2 text-sm text-zinc-300">Aviso minimo <span className="text-zinc-500">(minutos, 0-10080)</span><input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" defaultValue={settings.minimumNoticeMinutes} name="minimumNoticeMinutes" type="number" /></label>
                <label className="grid gap-2 text-sm text-zinc-300">Ventana de reserva <span className="text-zinc-500">(dias, 1-365)</span><input className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-apple-300" defaultValue={settings.maximumBookingWindowDays} name="maximumBookingWindowDays" type="number" /></label>
                <button className="mt-1 w-fit rounded-lg bg-apple-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-apple-300" type="submit">Guardar cambios</button>
              </form>
            </section>
          ) : null}

          {services.length > 0 ? (
            <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
              <h2 className="text-2xl font-black text-white">Catalogo de servicios</h2>
              <p className="mt-2 text-sm text-zinc-500">El toggle controla la visibilidad publica.</p>
              <div className="mt-5 grid gap-3">
                {services.map((service) => (
                  <form action={updateServiceVisibilityAction} className="flex items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3" key={service.id}>
                    <input name="serviceId" type="hidden" value={service.id} />
                    <input name="isActive" type="hidden" value={service.isActive ? "false" : "true"} />
                    <span>
                      <span className="block font-medium text-white">{service.name}</span>
                      <span className="mt-1 block text-xs text-zinc-500">{service.durationMinutes} min</span>
                    </span>
                    <button aria-label={service.isActive ? `Ocultar ${service.name}` : `Publicar ${service.name}`} className={`flex h-7 w-12 items-center rounded-full p-1 transition ${service.isActive ? "justify-end bg-apple-400" : "justify-start bg-zinc-600"}`} type="submit">
                      <span className="h-5 w-5 rounded-full bg-zinc-950 shadow" />
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}

function formatDisplayDate(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}
