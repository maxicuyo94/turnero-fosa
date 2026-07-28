import { cancelAppointmentAction } from "@/app/(public)/booking/actions";

type CancellationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CancellationPage({ searchParams }: CancellationPageProps) {
  const params = (await searchParams) ?? {};
  const appointmentId = stringParam(params.appointmentId) ?? "";
  const token = stringParam(params.token) ?? "";
  const message = stringParam(params.message);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-12 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.35em] text-apple-300">Taller Express</p>
      <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-white">Cancelar turno</h1>
      <p className="mt-4 text-zinc-300">
        Podes cancelar este turno online si la politica del taller lo permite. La reprogramacion online no esta disponible por ahora.
      </p>
      {message ? <p className="mt-6 rounded-2xl border border-apple-400/30 bg-apple-400/10 p-4 text-apple-100">{message}</p> : null}
      {appointmentId && token ? (
        <form action={cancelAppointmentAction} className="mt-8 rounded-[2rem] border border-white/10 bg-charcoal-900/80 p-5 shadow-2xl shadow-black/20">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="token" value={token} />
          <button className="rounded-2xl bg-apple-400 px-5 py-3 font-black text-zinc-950 transition hover:bg-apple-300" type="submit">
            Confirmar cancelacion
          </button>
        </form>
      ) : null}
      <a className="mt-8 text-sm font-semibold text-apple-300 underline-offset-4 hover:underline" href="/booking">
        Volver a turnos
      </a>
    </main>
  );
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
