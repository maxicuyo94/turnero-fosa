import type { ReactNode } from "react";
import {
  createVehicleTypeAction,
  updateBookingSettingsAction,
  updateContactSettingsAction,
  updateServiceDurationAction,
  updateServiceVisibilityAction,
  updateVehicleTypeVisibilityAction,
} from "@/app/(internal)/internal/settings/actions";
import { InternalShell, InternalSubNav } from "@/src/modules/internal/internal-shell";
import { CapacityWarning } from "@/src/modules/internal/capacity-warning";
import type { CapacityConflict } from "@/src/modules/appointments/capacity-conflicts";
import { ContactSettingsFields, DepositSettingsFields } from "@/src/modules/settings/business-settings-fields";
import { Alert, Card, Field, PageHeading, Select, TextInput } from "@/src/components/ui";
import { SubmitButton, SubmitToggle } from "@/src/components/pending";
import {
  settingsFeedbackMessages,
  settingsPageLabels,
  settingsPaths,
  type SettingsFeedbackCode,
  type SettingsPage,
} from "@/src/modules/internal/settings-navigation";
import type {
  InternalServiceRecord,
  InternalVehicleTypeRecord,
  InternalWorkshopSettingsRecord,
} from "@/src/modules/settings/maintenance";

/** Chrome shared by every Configuración page: section tabs, capacity warning and the last action's outcome. */
export function SettingsShell({
  active,
  capacity,
  capacityConflicts = [],
  feedback,
  signedInUserName,
  children,
}: {
  active: SettingsPage;
  capacity?: number;
  capacityConflicts?: CapacityConflict[];
  feedback?: SettingsFeedbackCode | null;
  signedInUserName?: string | null;
  children: ReactNode;
}) {
  const feedbackAlert = feedback ? settingsFeedbackMessages[feedback] : null;

  return (
    <InternalShell active="settings" canManageWorkshop signedInUserName={signedInUserName}>
      <PageHeading eyebrow="Gestión del taller" title="Configuración" />
      <div className="mt-6">
        <InternalSubNav
          items={(Object.keys(settingsPaths) as SettingsPage[]).map((page) => ({
            label: settingsPageLabels[page],
            href: settingsPaths[page],
            active: page === active,
          }))}
          label="Secciones de configuración"
        />
      </div>

      {capacity === undefined ? null : <CapacityWarning capacity={capacity} conflicts={capacityConflicts} />}

      {feedbackAlert ? (
        <Alert className="mt-6" tone={feedbackAlert.tone}>
          {feedbackAlert.message}
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5">{children}</div>
    </InternalShell>
  );
}

export function ContactSettingsCard({ settings }: { settings: InternalWorkshopSettingsRecord }) {
  return (
    <Card className="max-w-2xl">
      <form action={updateContactSettingsAction} className="grid gap-4">
        <ContactSettingsFields settings={settings} />
        <SubmitButton className="mt-1 w-fit" size="md">
          Guardar cambios
        </SubmitButton>
      </form>
    </Card>
  );
}

export function BookingSettingsCard({ settings }: { settings: InternalWorkshopSettingsRecord }) {
  return (
    <form action={updateBookingSettingsAction} className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="text-2xl font-black text-white">Reservas</h2>
        <div className="mt-6 grid gap-4">
          <Field hint="(con seña activa, la confirma el pago)" label="Confirmación de turnos">
            <Select defaultValue={settings.confirmationMode ?? "MANUAL"} name="confirmationMode">
              <option value="MANUAL">La confirma el taller</option>
              <option value="AUTOMATIC">Automática al reservar</option>
            </Select>
          </Field>
          <Field label="Permitir cancelación online">
            <input
              className="h-5 w-5 accent-apple-400"
              defaultChecked={settings.cancellationEnabled ?? false}
              name="cancellationEnabled"
              type="checkbox"
              value="true"
            />
          </Field>
          <Field hint="(1-20)" label="Capacidad simultánea">
            <TextInput defaultValue={settings.capacity} name="capacity" type="number" />
          </Field>
          <Field hint="(minutos, 0-10080)" label="Aviso mínimo">
            <TextInput defaultValue={settings.minimumNoticeMinutes} name="minimumNoticeMinutes" type="number" />
          </Field>
          <Field hint="(días, 1-365)" label="Ventana de reserva">
            <TextInput defaultValue={settings.maximumBookingWindowDays} name="maximumBookingWindowDays" type="number" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black text-white">Señas</h2>
        <div className="mt-6 grid gap-4">
          <Field label="Cobrar seña con Mercado Pago">
            <input
              className="h-5 w-5 accent-apple-400"
              defaultChecked={settings.depositRequired}
              name="depositRequired"
              type="checkbox"
              value="true"
            />
          </Field>
          <Field hint="(pesos argentinos)" label="Monto de la seña">
            <TextInput defaultValue={settings.depositAmountCents / 100} min={1} name="depositAmountArs" step="0.01" type="number" />
          </Field>
          <Field hint="(minutos, 5-10080)" label="Vencimiento de la reserva">
            <TextInput defaultValue={settings.depositExpirationMinutes} min={5} name="depositExpirationMinutes" type="number" />
          </Field>
          <DepositSettingsFields settings={settings} />
        </div>
      </Card>

      <SubmitButton className="w-fit" size="md">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}

export function VehicleTypesCard({ vehicleTypes }: { vehicleTypes: InternalVehicleTypeRecord[] }) {
  return (
    <Card>
      <h2 className="text-2xl font-black text-white">Tipos de vehículo</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Lo que el taller atiende. El toggle controla si se ofrece al reservar; un tipo no se borra, para no
        perder el historial de las unidades cargadas con él.
      </p>
      <div className="mt-5 grid gap-3">
        {vehicleTypes.map((vehicleType) => (
          <form
            action={updateVehicleTypeVisibilityAction}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3"
            key={vehicleType.id}
          >
            <input name="vehicleTypeId" type="hidden" value={vehicleType.id} />
            <input name="isActive" type="hidden" value={vehicleType.isActive ? "false" : "true"} />
            <span className="font-medium text-white">{vehicleType.name}</span>
            <SubmitToggle
              aria-label={vehicleType.isActive ? `Ocultar ${vehicleType.name}` : `Ofrecer ${vehicleType.name}`}
              checked={vehicleType.isActive}
            />
          </form>
        ))}
      </div>
      <form action={createVehicleTypeAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/5 pt-5">
        <Field label="Agregar tipo">
          <TextInput name="name" maxLength={40} placeholder="Cuatriciclo" required />
        </Field>
        <SubmitButton size="sm" variant="ghost">Agregar</SubmitButton>
      </form>
    </Card>
  );
}

export function ServicesCard({ services, slotStepMinutes }: { services: InternalServiceRecord[]; slotStepMinutes?: number }) {
  return (
    <Card>
      <h2 className="text-2xl font-black text-white">Catálogo de servicios</h2>
      <p className="mt-2 text-sm text-zinc-500">El toggle controla la visibilidad pública.</p>
      <div className="mt-5 grid gap-3">
        {services.map((service) => (
          <div key={service.id} className="rounded-xl border border-white/5 bg-charcoal-950 p-3">
            <form
              action={updateServiceVisibilityAction}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3"
            >
              <input name="serviceId" type="hidden" value={service.id} />
              <input name="isActive" type="hidden" value={service.isActive ? "false" : "true"} />
              <span>
                <span className="block font-medium text-white">{service.name}</span>
                <span className="mt-1 block text-xs text-zinc-500">{service.durationMinutes} min</span>
              </span>
              <SubmitToggle
                aria-label={service.isActive ? `Ocultar ${service.name}` : `Publicar ${service.name}`}
                checked={service.isActive}
              />
            </form>
            <form action={updateServiceDurationAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input name="serviceId" type="hidden" value={service.id} />
              <Field label={`Duración de ${service.name}`} hint="minutos">
                <TextInput
                  defaultValue={service.durationMinutes}
                  max={1440}
                  min={slotStepMinutes ?? 1}
                  name="durationMinutes"
                  required
                  step={slotStepMinutes ?? 1}
                  type="number"
                />
              </Field>
              <SubmitButton variant="ghost" size="sm">Guardar duración</SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </Card>
  );
}
