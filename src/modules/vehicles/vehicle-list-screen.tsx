import Form from "next/form";
import Link from "next/link";
import { Card, EmptyState, Field, PageHeading, TextInput } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";
import { InternalShell } from "@/src/modules/internal/internal-shell";
import type { VehicleSummary } from "@/src/modules/vehicles/service";

export type VehicleListScreenProps = {
  vehicles: VehicleSummary[];
  query: string;
  signedInUserName?: string | null;
  canManageWorkshop?: boolean;
};

export function VehicleListScreen({ vehicles, query, signedInUserName, canManageWorkshop }: VehicleListScreenProps) {
  return (
    <InternalShell active="vehicles" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}>
      <PageHeading
        description="Cada unidad acumula sus turnos. Buscá por patente, marca, modelo o cliente."
        eyebrow="Interno"
        title="Unidades"
      />

      <Card className="mt-8">
        <Form action="/internal/vehicles" className="flex flex-wrap items-end gap-3">
          <Field className="min-w-[16rem] flex-1" label="Buscar">
            <TextInput defaultValue={query} name="q" placeholder="AB123CD, Honda, Ana" />
          </Field>
          <SubmitButton size="sm" variant="ghost">Buscar</SubmitButton>
          {query ? (
            <Link className="text-sm text-zinc-500 underline" href="/internal/vehicles">Limpiar</Link>
          ) : null}
        </Form>
      </Card>

      <Card className="mt-6">
        {vehicles.length === 0 ? (
          <EmptyState>
            {query ? "Sin resultados. Probá con otra patente, marca o cliente." : "Todavía no hay unidades cargadas."}
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
    </InternalShell>
  );
}

function formatDate(value: Date) {
  return formatWorkshopDateTime(value, { day: "2-digit", month: "2-digit", year: "numeric" });
}
