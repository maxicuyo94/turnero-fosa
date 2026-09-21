import Link from "next/link";
import { Alert, Button, Card, EmptyState, Field, PageHeading, PageShell, SiteHeader, TextInput } from "@/src/components/ui";
import type { VehicleDuplicateGroup, VehicleSummary } from "@/src/modules/vehicles/service";

export type VehicleListScreenProps = {
  vehicles: VehicleSummary[];
  duplicateGroups: VehicleDuplicateGroup[];
  query: string;
  signedInUserName?: string | null;
  onSignOut?: () => void | Promise<void>;
};

export function VehicleListScreen({ vehicles, duplicateGroups, query, signedInUserName, onSignOut }: VehicleListScreenProps) {
  return (
    <>
      <SiteHeader accountHref="/internal/account" active="internal" linkComponent={Link} onSignOut={onSignOut} userName={signedInUserName} />
      <PageShell>
        <PageHeading
          description="Cada unidad acumula sus turnos. Busca por patente, marca, modelo o cliente."
          eyebrow="Interno"
          title="Unidades"
        />

        <Card>
          <form action="/internal/vehicles" className="flex flex-wrap items-end gap-3" method="get">
            <Field className="min-w-[16rem] flex-1" label="Buscar">
              <TextInput defaultValue={query} name="q" placeholder="AB123CD, Honda, Ana" />
            </Field>
            <Button size="sm" type="submit" variant="ghost">Buscar</Button>
            {query ? (
              <Link className="text-sm text-zinc-500 underline" href="/internal/vehicles">Limpiar</Link>
            ) : null}
          </form>
        </Card>

        {duplicateGroups.length > 0 ? (
          <Alert tone="info">
            <p className="font-medium">
              {duplicateGroups.length === 1
                ? "Hay 1 patente cargada en mas de una unidad."
                : `Hay ${duplicateGroups.length} patentes cargadas en mas de una unidad.`}
            </p>
            <p className="mt-1 text-sm">
              Vienen de turnos anteriores, cuando cada reserva creaba una unidad nueva. Abri una de ellas para revisar
              y fusionar; no se toca nada hasta que confirmes.
            </p>
            <ul className="mt-3 grid gap-1 text-sm">
              {duplicateGroups.map((group) => (
                <li key={group.plateNormalized}>
                  <Link className="underline" href={`/internal/vehicles/${group.vehicles[0].id}`}>
                    {group.plateNormalized}
                  </Link>{" "}
                  · {group.vehicles.length} unidades
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Card>
          {vehicles.length === 0 ? (
            <EmptyState>
              {query ? "Sin resultados. Proba con otra patente, marca o cliente." : "Todavia no hay unidades cargadas."}
            </EmptyState>
          ) : (
            <ul className="grid gap-2">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <Link
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3 hover:border-white/20"
                    href={`/internal/vehicles/${vehicle.id}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-black text-white">
                        {vehicle.brand} {vehicle.model}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {vehicle.licensePlate ?? "Sin patente"} · {vehicle.typeName} · {vehicle.ownerName}
                      </span>
                    </span>
                    <span className="text-right text-xs text-zinc-500">
                      <span className="block text-white">{vehicle.appointmentCount} turnos</span>
                      <span className="mt-1 block">
                        {vehicle.lastVisitAt ? `Ultimo: ${formatDate(vehicle.lastVisitAt)}` : "Sin visitas"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageShell>
    </>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}
