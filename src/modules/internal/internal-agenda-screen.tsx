import { signOutAction, updateAppointmentStatusAction } from "@/app/(internal)/internal/actions";
import {
  deleteDateExceptionAction,
  importHolidaysAction,
  saveDateExceptionAction,
  updateServiceVisibilityAction,
  updateWeeklyScheduleAction,
  updateWorkshopSettingsAction,
} from "@/app/(internal)/internal/actions";
import Link from "next/link";
import {
  Alert,
  AppointmentCard,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeading,
  PageShell,
  Select,
  SiteHeader,
  TextInput,
  Toggle,
  type AlertTone,
} from "@/src/components/ui";
import type {
  InternalServiceRecord,
  InternalWeeklyScheduleRecord,
  InternalWorkshopSettingsRecord,
} from "@/src/modules/internal/maintenance";
import { internalStatusOptions, statusLabel, type InternalAgenda } from "@/src/modules/internal/operations";
import { dayOfWeekSchema, type DayOfWeek, type ScheduleDateException } from "@/src/modules/settings/schemas";

export const internalFeedbackCodes = [
  "schedule-updated",
  "schedule-invalid",
  "exception-saved",
  "exception-deleted",
  "exception-invalid",
  "holidays-imported",
  "holidays-unavailable",
  "holidays-invalid",
] as const;

export type InternalFeedbackCode = (typeof internalFeedbackCodes)[number];

const feedbackMessages: Record<InternalFeedbackCode, { tone: AlertTone; message: string }> = {
  "schedule-updated": { tone: "success", message: "Actualizamos el horario semanal del taller." },
  "schedule-invalid": {
    tone: "danger",
    message: "Revisa los horarios: cada dia abierto debe cerrar mas tarde y los descansos deben quedar dentro del horario.",
  },
  "exception-saved": { tone: "success", message: "Guardamos la fecha especial." },
  "exception-deleted": { tone: "success", message: "Quitamos la fecha especial. Vuelve a regir el horario semanal." },
  "exception-invalid": {
    tone: "danger",
    message: "Revisa la fecha: una apertura excepcional necesita horario de apertura y cierre validos.",
  },
  "holidays-imported": { tone: "success", message: "Importamos los feriados nacionales sin tocar tus ajustes manuales." },
  "holidays-unavailable": {
    tone: "danger",
    message: "No pudimos consultar los feriados. Las fechas guardadas siguen vigentes.",
  },
  "holidays-invalid": {
    tone: "danger",
    message: "La respuesta de feriados no tiene el formato esperado. No se modifico ninguna fecha.",
  },
};

const dayLabels: Record<DayOfWeek, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miercoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sabado",
  SUNDAY: "Domingo",
};

export function InternalAgendaScreen({
  agenda,
  settings,
  services = [],
  schedule,
  exceptions = [],
  feedback,
  signedInUserName,
}: {
  agenda: InternalAgenda;
  settings?: InternalWorkshopSettingsRecord;
  services?: InternalServiceRecord[];
  schedule?: InternalWeeklyScheduleRecord;
  exceptions?: ScheduleDateException[];
  feedback?: InternalFeedbackCode | null;
  signedInUserName?: string | null;
}) {
  const feedbackAlert = feedback ? feedbackMessages[feedback] : null;

  return (
    <>
      <SiteHeader active="internal" linkComponent={Link} onSignOut={signOutAction} userName={signedInUserName} />

      <PageShell>
        <PageHeading eyebrow="Gestion del taller" title="Agenda" />

        {feedbackAlert ? (
          <Alert className="mt-6" tone={feedbackAlert.tone}>
            {feedbackAlert.message}
          </Alert>
        ) : null}

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

        {schedule ? <WeeklyScheduleCard agendaDate={agenda.date} schedule={schedule} /> : null}

        <DateExceptionsCard agendaDate={agenda.date} exceptions={exceptions} />
      </PageShell>
    </>
  );
}

function WeeklyScheduleCard({ agendaDate, schedule }: { agendaDate: string; schedule: InternalWeeklyScheduleRecord }) {
  return (
    <Card className="mt-5">
      <h2 className="text-2xl font-black text-white">Horario semanal</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Se guarda completo: los turnos publicos usan estos valores apenas confirmas los cambios.
      </p>

      <form action={updateWeeklyScheduleAction} className="mt-6 grid gap-4">
        <input name="agendaDate" type="hidden" value={agendaDate} />
        {dayOfWeekSchema.options.map((dayOfWeek) => {
          const day = schedule.schedules.find((item) => item.dayOfWeek === dayOfWeek);
          const dayBreaks = schedule.breaks.filter((item) => item.dayOfWeek === dayOfWeek);

          return (
            <fieldset className="rounded-xl border border-white/5 bg-charcoal-950 p-4" key={dayOfWeek}>
              <legend className="px-1 text-sm font-medium text-white">{dayLabels[dayOfWeek]}</legend>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
                <Field className="sm:items-center" label="Abierto">
                  <input
                    aria-label={`${dayLabels[dayOfWeek]}: abierto`}
                    className="h-5 w-5 accent-apple-400"
                    defaultChecked={day?.isOpen ?? false}
                    name={`isOpen-${dayOfWeek}`}
                    type="checkbox"
                    value="true"
                  />
                </Field>
                <Field label="Abre">
                  <TextInput
                    aria-label={`${dayLabels[dayOfWeek]}: abre`}
                    defaultValue={day?.opensAt ?? "09:00"}
                    density="sm"
                    name={`opensAt-${dayOfWeek}`}
                    type="time"
                  />
                </Field>
                <Field label="Cierra">
                  <TextInput
                    aria-label={`${dayLabels[dayOfWeek]}: cierra`}
                    defaultValue={day?.closesAt ?? "19:00"}
                    density="sm"
                    name={`closesAt-${dayOfWeek}`}
                    type="time"
                  />
                </Field>
              </div>

              <div className="mt-3 grid gap-3">
                {[...dayBreaks, null].map((scheduleBreak, index) => (
                  <div className="grid gap-3 sm:grid-cols-2" key={`${dayOfWeek}-break-${index}`}>
                    <Field label={`Descanso ${index + 1} desde`}>
                      <TextInput
                        aria-label={`${dayLabels[dayOfWeek]}: descanso ${index + 1} desde`}
                        defaultValue={scheduleBreak?.startsAt ?? ""}
                        density="sm"
                        name={`break-${dayOfWeek}-${index}-startsAt`}
                        type="time"
                      />
                    </Field>
                    <Field label={`Descanso ${index + 1} hasta`}>
                      <TextInput
                        aria-label={`${dayLabels[dayOfWeek]}: descanso ${index + 1} hasta`}
                        defaultValue={scheduleBreak?.endsAt ?? ""}
                        density="sm"
                        name={`break-${dayOfWeek}-${index}-endsAt`}
                        type="time"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}

        <Button className="mt-1 w-fit" size="md" type="submit">
          Guardar horarios
        </Button>
      </form>
    </Card>
  );
}

function DateExceptionsCard({ agendaDate, exceptions }: { agendaDate: string; exceptions: ScheduleDateException[] }) {
  return (
    <Card className="mt-5">
      <h2 className="text-2xl font-black text-white">Fechas especiales</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Feriados y cierres puntuales. Una fecha especial manda sobre el horario semanal.
      </p>

      {exceptions.length === 0 ? (
        <EmptyState className="mt-5">Todavia no hay fechas especiales cargadas.</EmptyState>
      ) : (
        <div className="mt-5 grid gap-3">
          {exceptions.map((exception) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3"
              key={exception.date}
            >
              <span>
                <span className="block font-medium text-white">{exception.label ?? "Sin motivo"}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  <span>{formatDisplayDate(exception.date)}</span>
                  {" · "}
                  <span>{exception.isOpen ? `Abre ${exception.opensAt} a ${exception.closesAt}` : "Cerrado"}</span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <Chip>{exception.manualOverride ? "Manual" : "Importado"}</Chip>
                <form action={deleteDateExceptionAction}>
                  <input name="agendaDate" type="hidden" value={agendaDate} />
                  <input name="exceptionDate" type="hidden" value={exception.date} />
                  <Button aria-label={`Eliminar la excepcion del ${exception.date}`} type="submit" variant="ghost">
                    Eliminar
                  </Button>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}

      <form action={saveDateExceptionAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <input name="agendaDate" type="hidden" value={agendaDate} />
        <Field label="Fecha">
          <TextInput density="sm" name="date" required type="date" />
        </Field>
        <Field label="Motivo">
          <TextInput density="sm" name="label" placeholder="Feriado, mudanza, capacitacion" type="text" />
        </Field>
        <Field className="sm:items-center" label="Abre excepcionalmente">
          <input className="h-5 w-5 accent-apple-400" name="isOpen" type="checkbox" value="true" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Abre">
            <TextInput density="sm" name="opensAt" type="time" />
          </Field>
          <Field label="Cierra">
            <TextInput density="sm" name="closesAt" type="time" />
          </Field>
        </div>
        <Button className="w-fit" size="md" type="submit">
          Guardar excepcion
        </Button>
      </form>

      <form action={importHolidaysAction} className="mt-6 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-end">
        <input name="agendaDate" type="hidden" value={agendaDate} />
        <Field hint="(feriados nacionales de Argentina)" label="Ano">
          <TextInput defaultValue={agendaDate.slice(0, 4)} density="sm" max={2100} min={2000} name="year" type="number" />
        </Field>
        <Button size="md" type="submit" variant="ghost">
          Importar feriados
        </Button>
      </form>
    </Card>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}

function formatDisplayDate(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}
