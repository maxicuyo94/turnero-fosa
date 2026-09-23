import {
  signOutAction,
  createVehicleTypeAction,
  updateVehicleTypeVisibilityAction,
  updateServiceVisibilityAction,
  updateServiceDurationAction,
  updateWorkshopSettingsAction,
} from "@/app/(internal)/internal/actions";
import Link from "next/link";
import { CapacityWarning } from "@/src/modules/internal/capacity-warning";
import type { CapacityConflict } from "@/src/modules/appointments/capacity-conflicts";
import { PaidDepositWarning } from "@/src/modules/internal/paid-deposit-warning";
import type { PaidUnconfirmedDeposit } from "@/src/modules/payments/prisma-repository";
import { ContactSettingsFields, DepositSettingsFields } from "@/src/modules/settings/business-settings-fields";
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeading,
  PageShell,
  SiteHeader,
  TextInput,
  Toggle,
  type AlertTone,
} from "@/src/components/ui";
import type {
  InternalServiceRecord,
  InternalVehicleTypeRecord,
  InternalWeeklyScheduleRecord,
  InternalWorkshopSettingsRecord,
} from "@/src/modules/settings/maintenance";
import { agendaHref, type AgendaView } from "@/src/modules/appointments/agenda-navigation";
import { InternalAgendaWorkspace } from "@/src/modules/internal/internal-agenda-workspace";
import { intervalRejectionMessage, type InternalAgenda } from "@/src/modules/appointments/operations";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";
import { DateExceptionsCard, WeeklyScheduleCard } from "@/src/modules/internal/schedule-settings";

export const internalFeedbackCodes = [
  "settings-updated", "settings-invalid", "service-updated", "service-invalid",
  "schedule-updated",
  "schedule-invalid",
  "exception-saved",
  "exception-deleted",
  "exception-invalid",
  "holidays-imported",
  "holidays-unavailable",
  "holidays-invalid",
  "status-updated",
  "status-invalid",
  "appointment-not-found",
  "appointment-rescheduled",
  "reschedule-invalid-input",
  "reschedule-terminal",
  "reschedule-invalid-duration",
  "reschedule-closed-date",
  "reschedule-outside-opening-hours",
  "reschedule-break-overlap",
  "reschedule-day-boundary-exceeded",
  "reschedule-capacity-exhausted",
  "vehicle-type-created",
  "vehicle-type-updated",
  "vehicle-type-invalid",
  "forbidden",
] as const;

export type InternalFeedbackCode = (typeof internalFeedbackCodes)[number];
export type InternalSection = "agenda" | "settings";

const feedbackMessages: Record<InternalFeedbackCode, { tone: AlertTone; message: string }> = {
  "settings-updated": { tone: "success", message: "Guardamos la configuración del taller." },
  "settings-invalid": { tone: "danger", message: "Revisá los datos: teléfono y WhatsApp válidos, dominio HTTPS sin rutas, remitente de email, fecha existente y valores numéricos dentro del rango." },
  "service-updated": { tone: "success", message: "Guardamos la duración para los nuevos turnos. Los turnos existentes conservan su horario." },
  "service-invalid": { tone: "danger", message: "La duración debe ser de 1 a 1440 minutos." },
  "schedule-updated": { tone: "success", message: "Actualizamos el horario semanal del taller." },
  "schedule-invalid": {
    tone: "danger",
    message: "Revisá los horarios: cada día abierto debe cerrar más tarde y los descansos deben quedar dentro del horario.",
  },
  "exception-saved": { tone: "success", message: "Guardamos la fecha especial." },
  "exception-deleted": { tone: "success", message: "Quitamos la fecha especial. Vuelve a regir el horario semanal." },
  "exception-invalid": {
    tone: "danger",
    message: "Revisá la fecha: una apertura excepcional necesita horario de apertura y cierre válidos.",
  },
  "holidays-imported": { tone: "success", message: "Importamos los feriados nacionales sin tocar tus ajustes manuales." },
  "holidays-unavailable": {
    tone: "danger",
    message: "No pudimos consultar los feriados. Las fechas guardadas siguen vigentes.",
  },
  "holidays-invalid": {
    tone: "danger",
    message: "La respuesta de feriados no tiene el formato esperado. No se modificó ninguna fecha.",
  },
  "status-updated": { tone: "success", message: "Actualizamos el estado del turno." },
  "status-invalid": {
    tone: "danger",
    message: "No se pudo cambiar el estado: el turno ya no admite ese cambio. Recargá la agenda para ver su estado actual.",
  },
  "appointment-not-found": { tone: "danger", message: "No encontramos el turno. Puede haber sido eliminado." },
  "appointment-rescheduled": { tone: "success", message: "El turno fue reprogramado correctamente." },
  "reschedule-invalid-input": { tone: "danger", message: "Revisá la fecha, el horario y la duración elegidos." },
  "reschedule-terminal": { tone: "danger", message: "No se puede reprogramar un turno finalizado." },
  "reschedule-invalid-duration": { tone: "danger", message: intervalRejectionMessage("INVALID_DURATION") },
  "reschedule-closed-date": { tone: "danger", message: intervalRejectionMessage("CLOSED_DATE") },
  "reschedule-outside-opening-hours": { tone: "danger", message: intervalRejectionMessage("OUTSIDE_OPENING_HOURS") },
  "reschedule-break-overlap": { tone: "danger", message: intervalRejectionMessage("BREAK_OVERLAP") },
  "reschedule-day-boundary-exceeded": { tone: "danger", message: intervalRejectionMessage("DAY_BOUNDARY_EXCEEDED") },
  "reschedule-capacity-exhausted": { tone: "danger", message: intervalRejectionMessage("CAPACITY_EXHAUSTED") },
  "vehicle-type-created": { tone: "success", message: "Agregamos el tipo de vehículo." },
  "vehicle-type-updated": { tone: "success", message: "Actualizamos la visibilidad del tipo de vehículo." },
  "vehicle-type-invalid": {
    tone: "danger",
    message: "No se pudo guardar el tipo de vehículo: el nombre es obligatorio, de hasta 40 caracteres y sin repetir, y debe quedar al menos un tipo activo.",
  },
  forbidden: { tone: "danger", message: "Esa sección es solo para administradores del taller." },
};

export function InternalAgendaScreen({
  agenda,
  weekAgendas = [agenda],
  section = "agenda",
  settings,
  capacityConflicts = [],
  paidUnconfirmedDeposits = [],
  services = [],
  vehicleTypes = [],
  schedule,
  exceptions = [],
  feedback,
  signedInUserName,
  today = agenda.date,
  view = "day",
  canManageWorkshop = true,
}: {
  agenda: InternalAgenda;
  weekAgendas?: InternalAgenda[];
  section?: InternalSection;
  settings?: InternalWorkshopSettingsRecord;
  capacityConflicts?: CapacityConflict[];
  paidUnconfirmedDeposits?: PaidUnconfirmedDeposit[];
  services?: InternalServiceRecord[];
  vehicleTypes?: InternalVehicleTypeRecord[];
  schedule?: InternalWeeklyScheduleRecord;
  exceptions?: ScheduleDateException[];
  feedback?: InternalFeedbackCode | null;
  signedInUserName?: string | null;
  today?: string;
  view?: AgendaView;
  /** Administrators only: shows the Configuración section. */
  canManageWorkshop?: boolean;
}) {
  const feedbackAlert = feedback ? feedbackMessages[feedback] : null;

  return (
    <>
      <SiteHeader accountHref="/internal/account" active="internal" linkComponent={Link} onSignOut={signOutAction} userName={signedInUserName} />

      <PageShell>
        <PageHeading
          eyebrow="Gestión del taller"
          title={section === "agenda" ? "Agenda" : "Configuración"}
        />

        <nav aria-label="Secciones del panel" className="mt-7 flex gap-2 overflow-x-auto border-b border-white/10">
          <InternalNavLink active={section === "agenda"} href={agendaHref({ date: agenda.date, view })}>
            Agenda
          </InternalNavLink>
          {canManageWorkshop ? (
            <InternalNavLink active={section === "settings"} href={`/internal?section=settings&date=${agenda.date}`}>
              Configuración
            </InternalNavLink>
          ) : null}
          <InternalNavLink active={false} href="/internal/vehicles">
            Unidades
          </InternalNavLink>
          <InternalNavLink active={false} href="/internal/shop">
            Repuestos
          </InternalNavLink>
          <InternalNavLink active={false} href="/internal/account">
            Mi cuenta
          </InternalNavLink>
        </nav>

        {settings ? <CapacityWarning capacity={settings.capacity} conflicts={capacityConflicts} /> : null}
        <PaidDepositWarning deposits={paidUnconfirmedDeposits} />

        {feedbackAlert ? (
          <Alert className="mt-6" tone={feedbackAlert.tone}>
            {feedbackAlert.message}
          </Alert>
        ) : null}

        {section === "agenda" || !canManageWorkshop ? (
          <InternalAgendaWorkspace
            agenda={agenda}
            capacity={settings?.capacity}
            exceptions={exceptions}
            slotStepMinutes={settings?.slotStepMinutes}
            today={today}
            view={view}
            weekAgendas={weekAgendas}
          />
        ) : (
          <div className="mt-8">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-white">Preferencias del taller</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                Administrá la capacidad, los servicios publicados y la disponibilidad sin mezclar estos cambios con la operación diaria.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {settings ? (
            <Card>
              <h2 className="text-2xl font-black text-white">Configuración general</h2>
              <form action={updateWorkshopSettingsAction} className="mt-6 grid gap-4">
                <ContactSettingsFields settings={settings} />
                <h3 className="mt-3 text-lg font-bold text-white">Operación y señas</h3>
                <Field hint="(1-20)" label="Capacidad simultánea">
                  <TextInput defaultValue={settings.capacity} name="capacity" type="number" />
                </Field>
                <Field hint="(minutos, 0-10080)" label="Aviso mínimo">
                  <TextInput
                    defaultValue={settings.minimumNoticeMinutes}
                    name="minimumNoticeMinutes"
                    type="number"
                  />
                </Field>
                <Field hint="(días, 1-365)" label="Ventana de reserva">
                  <TextInput
                    defaultValue={settings.maximumBookingWindowDays}
                    name="maximumBookingWindowDays"
                    type="number"
                  />
                </Field>
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
                  <TextInput
                    defaultValue={settings.depositAmountCents / 100}
                    min={1}
                    name="depositAmountArs"
                    step="0.01"
                    type="number"
                  />
                </Field>
                <Field hint="(minutos, 5-10080)" label="Vencimiento de la reserva">
                  <TextInput
                    defaultValue={settings.depositExpirationMinutes}
                    min={5}
                    name="depositExpirationMinutes"
                    type="number"
                  />
                </Field>
                <DepositSettingsFields settings={settings} />
                <Button className="mt-1 w-fit" size="md" type="submit">
                  Guardar cambios
                </Button>
              </form>
            </Card>
          ) : null}

          {vehicleTypes.length > 0 ? (
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
                    <Toggle
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
                <Button size="sm" type="submit" variant="ghost">Agregar</Button>
              </form>
            </Card>
          ) : null}

          {services.length > 0 ? (
            <Card>
              <h2 className="text-2xl font-black text-white">Catálogo de servicios</h2>
              <p className="mt-2 text-sm text-zinc-500">El toggle controla la visibilidad pública.</p>
              <div className="mt-5 grid gap-3">
                {services.map((service) => (
                  <div key={service.id} className="rounded-xl border border-white/5 bg-charcoal-950 p-3">
                  <form
                    action={updateServiceVisibilityAction}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3"
                    key={service.id}
                  >
                    <input name="serviceId" type="hidden" value={service.id} />
                    <input name="isActive" type="hidden" value={service.isActive ? "false" : "true"} />
                    <span>
                      <span className="block font-medium text-white">{service.name}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {service.durationMinutes} min
                      </span>
                    </span>
                    <Toggle
                      aria-label={service.isActive ? `Ocultar ${service.name}` : `Publicar ${service.name}`}
                      checked={service.isActive}
                    />
                  </form>
                  <form action={updateServiceDurationAction} className="mt-3 flex flex-wrap items-end gap-3">
                    <input name="serviceId" type="hidden" value={service.id} />
                    <Field label={`Duración de ${service.name}`} hint="minutos">
                      <TextInput name="durationMinutes" type="number" min={1} max={1440} step={1} required defaultValue={service.durationMinutes} />
                    </Field>
                    <Button type="submit" variant="ghost" size="sm">Guardar duración</Button>
                  </form>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
            </div>

            {schedule ? <WeeklyScheduleCard agendaDate={agenda.date} schedule={schedule} /> : null}

            <DateExceptionsCard agendaDate={agenda.date} exceptions={exceptions} />
          </div>
        )}
      </PageShell>
    </>
  );
}

function InternalNavLink({ active, href, children }: { active: boolean; href: string; children: string }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`border-b-2 px-5 py-3 text-sm font-black transition ${
        active ? "border-apple-400 text-white" : "border-transparent text-zinc-500 hover:text-white"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
