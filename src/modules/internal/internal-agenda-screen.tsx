import { signOutAction, updateAppointmentStatusAction } from "@/app/(internal)/internal/actions";
import { updateServiceVisibilityAction, updateWorkshopSettingsAction } from "@/app/(internal)/internal/actions";
import Link from "next/link";
import {
  AppointmentCard,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeading,
  PageShell,
  Select,
  SiteHeader,
  TextInput,
  Toggle,
} from "@/src/components/ui";
import type { InternalServiceRecord, InternalWorkshopSettingsRecord } from "@/src/modules/internal/maintenance";
import { internalStatusOptions, statusLabel, type InternalAgenda } from "@/src/modules/internal/operations";

export function InternalAgendaScreen({
  agenda,
  settings,
  services = [],
  signedInUserName,
}: {
  agenda: InternalAgenda;
  settings?: InternalWorkshopSettingsRecord;
  services?: InternalServiceRecord[];
  signedInUserName?: string | null;
}) {
  return (
    <>
      <SiteHeader active="internal" linkComponent={Link} onSignOut={signOutAction} userName={signedInUserName} />

      <PageShell>
        <PageHeading eyebrow="Gestion del taller" title="Agenda" />

        <Card className="mt-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Turnos del dia</h2>
              <p className="mt-2 text-sm text-zinc-500">
                {formatDisplayDate(agenda.date)} · {agenda.appointments.length} Turnos
              </p>
            </div>
            <form action="/internal" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Fecha">
                <TextInput defaultValue={agenda.date} density="sm" name="date" type="date" />
              </Field>
              <Button type="submit">Ver</Button>
            </form>
          </div>

          {agenda.appointments.length === 0 ? (
            <EmptyState className="mt-6">No hay turnos agendados para esta fecha.</EmptyState>
          ) : (
            <div className="mt-6 grid gap-4">
              {agenda.appointments.map((appointment) => (
                <AppointmentCard
                  action={
                    <form
                      action={updateAppointmentStatusAction}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:min-w-52"
                    >
                      <input name="appointmentId" type="hidden" value={appointment.id} />
                      <input name="date" type="hidden" value={agenda.date} />
                      <Field label="Estado">
                        <Select
                          defaultValue={appointment.status}
                          density="sm"
                          name="nextStatus"
                        >
                          {internalStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button size="md" type="submit">
                        Actualizar
                      </Button>
                    </form>
                  }
                  customerName={appointment.customerName}
                  key={appointment.id}
                  meta={`${appointment.motorcycleLabel} · ${appointment.customerPhone}`}
                  notes={appointment.notes}
                  serviceName={appointment.serviceName}
                  timeLabel={`${formatTime(appointment.startAt)}-${formatTime(appointment.endAt)} · ${statusLabel(appointment.status)}`}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          {settings ? (
            <Card>
              <h2 className="text-2xl font-black text-white">Configuracion del taller</h2>
              <form action={updateWorkshopSettingsAction} className="mt-6 grid gap-4">
                <Field hint="(1-20)" label="Capacidad simultanea">
                  <TextInput defaultValue={settings.capacity} name="capacity" type="number" />
                </Field>
                <Field hint="(minutos, 0-10080)" label="Aviso minimo">
                  <TextInput
                    defaultValue={settings.minimumNoticeMinutes}
                    name="minimumNoticeMinutes"
                    type="number"
                  />
                </Field>
                <Field hint="(dias, 1-365)" label="Ventana de reserva">
                  <TextInput
                    defaultValue={settings.maximumBookingWindowDays}
                    name="maximumBookingWindowDays"
                    type="number"
                  />
                </Field>
                <Button className="mt-1 w-fit" size="md" type="submit">
                  Guardar cambios
                </Button>
              </form>
            </Card>
          ) : null}

          {services.length > 0 ? (
            <Card>
              <h2 className="text-2xl font-black text-white">Catalogo de servicios</h2>
              <p className="mt-2 text-sm text-zinc-500">El toggle controla la visibilidad publica.</p>
              <div className="mt-5 grid gap-3">
                {services.map((service) => (
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
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </PageShell>
    </>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}

function formatDisplayDate(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}
