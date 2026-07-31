import { SiteHeader } from "@/src/components/site-header";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";
import type { PublicAppointmentStatusResult } from "@/src/modules/booking/service";

type PublicAppointmentStatusScreenProps = {
  code?: string;
  result?: PublicAppointmentStatusResult;
};

export function PublicAppointmentStatusScreen({ code = "", result }: PublicAppointmentStatusScreenProps) {
  return (
    <>
      <SiteHeader active="booking" />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-6 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.55em] text-apple-300">Seguimiento</p>
        <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-white">Consultar turno</h1>
        <p className="mt-4 max-w-2xl text-zinc-400">Ingresa el codigo que recibiste al reservar para ver el estado actual.</p>

        <form action="/booking/status" className="mt-8 flex flex-col gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-2 text-sm font-medium text-zinc-300">
            Codigo del turno
            <input
              autoComplete="off"
              className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-[0.14em] text-white outline-none transition focus:border-apple-300"
              defaultValue={code}
              maxLength={32}
              name="code"
              placeholder="ABCD234567"
              required
            />
          </label>
          <button className="rounded-xl bg-apple-400 px-6 py-3 font-black text-zinc-950 transition hover:bg-apple-300" type="submit">
            Consultar
          </button>
        </form>

        {result?.accepted ? <AppointmentSummary appointment={result.appointment} /> : null}
        {result && !result.accepted ? (
          <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 p-5 text-red-100" role="alert">{result.message}</p>
        ) : null}
      </main>
    </>
  );
}

function AppointmentSummary({ appointment }: { appointment: Extract<PublicAppointmentStatusResult, { accepted: true }>["appointment"] }) {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.7rem] border border-apple-400/30 bg-gradient-to-br from-apple-400/15 to-white/[0.03] p-6" aria-label="Estado del turno">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Codigo</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-[0.14em] text-white">{appointment.publicCode}</p>
        </div>
        <span className="w-fit rounded-full border border-apple-300/30 bg-apple-400/15 px-4 py-2 text-sm font-black text-apple-200">
          {statusLabel(appointment.status)}
        </span>
      </div>
      <dl className="grid gap-5 pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Servicio</dt>
          <dd className="mt-2 text-lg font-bold text-white">{appointment.serviceName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Fecha y horario</dt>
          <dd className="mt-2 text-lg font-bold text-white">{formatAppointmentTime(appointment.startAt, appointment.endAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function statusLabel(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    PENDING_CONFIRMATION: "Pendiente",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En curso",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    NO_SHOW: "Ausente",
  };
  return labels[status];
}

function formatAppointmentTime(startAt: Date, endAt: Date): string {
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Salta" }).format(startAt);
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Salta" });
  return `${date}, ${time.format(startAt)} a ${time.format(endAt)}`;
}
