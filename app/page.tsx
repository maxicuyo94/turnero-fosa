import Link from "next/link";
import { Chip, PageHeading, PageShell, RouteCard, SiteHeader } from "@/src/components/ui";
import { auth, getInternalSessionDisplayName } from "@/src/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const userName = getInternalSessionDisplayName(session);

  return (
    <>
      <SiteHeader active="home" linkComponent={Link} userName={userName} />
      <PageShell>
        <PageHeading
          description="Reserva tu turno online en segundos o gestiona la agenda del taller. Simple, rapido y sin llamadas."
          eyebrow="Taller de motos"
          size="lg"
          title="Taller de motos Express"
        />

        <section className="mt-9 grid gap-5 md:grid-cols-2">
          <RouteCard
            actionLabel="Ir a reservar →"
            description="Elegi el servicio, la fecha y el horario que mejor te quede."
            eyebrow="Publico"
            href="/booking"
            linkComponent={Link}
            title="Reserva tu turno online"
          />
          <RouteCard
            actionLabel="Ingresar →"
            description="Agenda del dia, configuracion y catalogo de servicios."
            eyebrow="Internos"
            href="/internal"
            linkComponent={Link}
            title="Gestion del taller"
          />
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Chip>Turnos programados</Chip>
          <Chip>Confirmacion automatica</Chip>
          <Chip>Sin cancelacion online</Chip>
        </div>
      </PageShell>
    </>
  );
}
