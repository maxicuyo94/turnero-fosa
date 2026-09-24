import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeading,
  Select,
  TextInput,
  Textarea,
} from "@/src/components/ui";
import { formatWorkshopDateTime } from "@/src/lib/workshop-date";
import { InternalBackLink, InternalShell } from "@/src/modules/internal/internal-shell";
import type { VehicleRecord } from "@/src/modules/vehicles/service";

export type VehicleRecordScreenProps = {
  vehicle: VehicleRecord;
  vehicleTypes: { id: string; name: string }[];
  feedback?: string | null;
  saveAction?: (formData: FormData) => void | Promise<void>;
  signedInUserName?: string | null;
  canManageWorkshop?: boolean;
};

const statusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Pendiente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En taller",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "No asistio",
};

export function VehicleRecordScreen({
  vehicle,
  vehicleTypes,
  feedback,
  saveAction,
  signedInUserName,
  canManageWorkshop,
}: VehicleRecordScreenProps) {
  return (
    <InternalShell active="vehicles" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}>
      <InternalBackLink href="/internal/vehicles">Volver a unidades</InternalBackLink>
      <PageHeading
        className="mt-7"
        description={`${vehicle.licensePlate ?? "Sin patente"} · ${vehicle.typeName} · ${vehicle.ownerName}`}
        eyebrow="Unidad"
        title={`${vehicle.brand} ${vehicle.model}`}
      />

      {feedback ? <Alert className="mt-6" tone={feedback.includes("invalid") ? "danger" : "success"}>{feedbackMessage(feedback)}</Alert> : null}

      <Card className="mt-8">
        <h2 className="text-2xl font-black text-white">Historial</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {vehicle.appointmentCount === 0
            ? "Todavía sin turnos."
            : `${vehicle.appointmentCount} turnos registrados, del mas reciente al mas antiguo.`}
        </p>

        {vehicle.appointments.length === 0 ? (
          <EmptyState className="mt-5">Esta unidad todavia no tiene turnos.</EmptyState>
        ) : (
          <ol className="mt-5 grid gap-3">
            {vehicle.appointments.map((appointment) => (
              <li className="rounded-xl border border-white/5 bg-charcoal-950 p-4" key={appointment.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-black text-white">{formatDateTime(appointment.startAt)}</span>
                  <span className="text-xs uppercase tracking-wide text-lime-300">
                    {statusLabels[appointment.status] ?? appointment.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{appointment.serviceName}</p>
                {appointment.notes ? <p className="mt-2 text-sm text-zinc-500">{appointment.notes}</p> : null}
                <p className="mt-2 text-xs text-zinc-600">Codigo {appointment.publicCode}</p>
              </li>
            ))}
          </ol>
        )}

        {vehicle.ownerChanges.length > 0 ? (
          <div className="mt-6 border-t border-white/5 pt-5">
            <h3 className="text-sm font-black uppercase tracking-wide text-zinc-400">Cambios de dueño</h3>
            <ul className="mt-3 grid gap-2 text-sm text-zinc-400">
              {vehicle.ownerChanges.map((change) => (
                <li key={change.id}>
                  {formatDateTime(change.changedAt)} · {change.previousOwnerName ?? "Sin registro"} → {change.newOwnerName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="mt-6">
        <h2 className="text-2xl font-black text-white">Ficha</h2>
        <p className="mt-2 text-sm text-zinc-500">
          La patente no se edita acá: identifica a la unidad y cambiarla partiría o mezclaría historiales.
        </p>
        <form action={saveAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <input name="vehicleId" type="hidden" value={vehicle.id} />
          <Field label="Tipo de vehículo">
            <Select defaultValue={vehicle.vehicleTypeId} name="vehicleTypeId" required>
              {vehicleTypes.map((vehicleType) => (
                <option key={vehicleType.id} value={vehicleType.id}>{vehicleType.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Patente" hint="No editable">
            <TextInput defaultValue={vehicle.licensePlate ?? "Sin patente"} disabled readOnly />
          </Field>
          <Field label="Marca">
            <TextInput defaultValue={vehicle.brand} maxLength={60} name="brand" required />
          </Field>
          <Field label="Modelo">
            <TextInput defaultValue={vehicle.model} maxLength={60} name="model" required />
          </Field>
          <Field label="Año">
            <TextInput defaultValue={vehicle.year ?? ""} max={2100} min={1900} name="year" type="number" />
          </Field>
          <Field label="Color">
            <TextInput defaultValue={vehicle.color ?? ""} maxLength={30} name="color" />
          </Field>
          <Field label="Número de chasis (VIN)">
            <TextInput defaultValue={vehicle.vin ?? ""} maxLength={40} name="vin" />
          </Field>
          <Field label="Número de motor">
            <TextInput defaultValue={vehicle.engineNumber ?? ""} maxLength={40} name="engineNumber" />
          </Field>
          <Field className="md:col-span-2" label="Notas internas">
            <Textarea defaultValue={vehicle.notes ?? ""} maxLength={1000} name="notes" />
          </Field>
          <div className="md:col-span-2">
            <Button size="sm" type="submit" variant="ghost">Guardar ficha</Button>
          </div>
        </form>
      </Card>

    </InternalShell>
  );
}

function feedbackMessage(feedback: string) {
  if (feedback === "vehicle-saved") return "Ficha actualizada.";
  if (feedback === "vehicle-invalid") return "Revisá los datos del vehículo.";
  return feedback;
}

function formatDateTime(value: Date) {
  return formatWorkshopDateTime(value, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
