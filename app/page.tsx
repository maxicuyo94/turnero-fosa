import { RouteCard } from "@/src/components/route-card";
import { SiteHeader } from "@/src/components/site-header";
import { auth, getInternalSessionDisplayName } from "@/src/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const userName = getInternalSessionDisplayName(session);

  return (
    <>
      <SiteHeader active="home" userName={userName} />
      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.55em] text-apple-300">Taller de motos</p>
        <h1 className="mt-5 text-6xl font-black tracking-[-0.06em] text-white md:text-7xl">
          Taller de motos Express
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
          Reserva tu turno online en segundos o gestiona la agenda del taller. Simple, rapido y sin llamadas.
        </p>

      <section className="mt-9 grid gap-5 md:grid-cols-2">
        <RouteCard
          actionLabel="Ir a reservar →"
          description="Elegi el servicio, la fecha y el horario que mejor te quede."
          eyebrow="Publico"
          href="/booking"
          title="Reserva tu turno online"
        />
        <RouteCard
          actionLabel="Ingresar →"
          description="Agenda del dia, configuracion y catalogo de servicios."
          eyebrow="Internos"
          href="/internal"
          title="Gestion del taller"
        />
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">Turnos programados</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">Confirmacion automatica</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">Sin cancelacion online</span>
      </div>
      </main>
    </>
  );
}
