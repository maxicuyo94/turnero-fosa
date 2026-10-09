import Link from "next/link";
import { WorkshopContact } from "@/src/modules/settings/workshop-contact";
import { Card, Chip, PageHeading, PageShell, SiteHeader } from "@/src/components/ui";
import { getStaffMember } from "@/src/lib/staff-access";
import { publicBookingPolicy, workshopContactSettings } from "@/src/lib/composition";

export default async function HomePage() {
  const [staff, contact, policy] = await Promise.all([getStaffMember(), workshopContactSettings(), publicBookingPolicy()]);
  const userName = staff?.displayName ?? null;

  return (
    <>
      <SiteHeader active="home" linkComponent={Link} userName={userName} />
      <PageShell>
        <PageHeading
          description="Elegí cuándo traer tu moto. Reservá online y consultá tu turno sin crear una cuenta."
          eyebrow="Taller de motos"
          size="lg"
          title="Taller de motos Express"
        />

        <section className="mt-9 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card className="border-apple-300/30 bg-apple-400/[0.06]">
            <h2 className="text-2xl font-black text-white">Reservá tu turno online</h2>
            <p className="mt-3 text-zinc-300">Elegí el servicio, la fecha y el horario que mejor te quede.</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link className="inline-flex min-h-11 items-center rounded-xl bg-apple-400 px-5 py-3 font-black text-zinc-950 hover:bg-apple-300" href="/booking">Ir a reservar →</Link>
              <Link className="inline-flex min-h-11 items-center font-bold text-white underline underline-offset-4" href="/booking/status">Consultar mi turno</Link>
            </div>
          </Card>
          <aside className="flex flex-col justify-center rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white">¿Trabajás en el taller?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Ingresá al panel para gestionar la agenda, las unidades y los repuestos.</p>
            <Link className="mt-3 inline-flex min-h-11 w-fit items-center text-sm font-bold text-zinc-300 underline underline-offset-4" href="/internal">Acceso al taller →</Link>
          </aside>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Chip>Turnos programados</Chip>
          {policy ? (
            <>
              <Chip>
                {policy.depositActive
                  ? "Se confirma con seña"
                  : policy.automaticConfirmation
                    ? "Confirmación automática"
                    : "Confirmación del taller"}
              </Chip>
              <Chip>{policy.cancellationEnabled ? "Cancelación online" : "Sin cancelación online"}</Chip>
            </>
          ) : null}
        </div>
      </PageShell>
      <WorkshopContact settings={contact} />
    </>
  );
}
