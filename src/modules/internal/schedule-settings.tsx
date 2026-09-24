import {
  deleteDateExceptionAction,
  importHolidaysAction,
  saveDateExceptionAction,
  updateWeeklyScheduleAction,
} from "@/app/(internal)/internal/actions";
import { Card, Chip, EmptyState, Field, TextInput } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { formatWorkshopCalendarDate } from "@/src/lib/workshop-date";
import type { InternalWeeklyScheduleRecord } from "@/src/modules/settings/maintenance";
import { dayOfWeekSchema, type DayOfWeek, type ScheduleDateException } from "@/src/modules/settings/schemas";

const dayLabels: Record<DayOfWeek, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export function WeeklyScheduleCard({ agendaDate, schedule }: { agendaDate: string; schedule: InternalWeeklyScheduleRecord }) {
  return (
    <Card className="mt-5">
      <h2 className="text-2xl font-black text-white">Horario semanal</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Se guarda completo: los turnos públicos usan estos valores apenas confirmás los cambios.
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

        <SubmitButton className="mt-1 w-fit" size="md">
          Guardar horarios
        </SubmitButton>
      </form>
    </Card>
  );
}

export function DateExceptionsCard({ agendaDate, exceptions }: { agendaDate: string; exceptions: ScheduleDateException[] }) {
  return (
    <Card className="mt-5">
      <h2 className="text-2xl font-black text-white">Fechas especiales</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Feriados y cierres puntuales. Una fecha especial manda sobre el horario semanal.
      </p>

      {exceptions.length === 0 ? (
        <EmptyState className="mt-5">Todavía no hay fechas especiales cargadas.</EmptyState>
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
                  <SubmitButton aria-label={`Eliminar la excepción del ${exception.date}`} variant="ghost">
                    Eliminar
                  </SubmitButton>
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
          <TextInput density="sm" name="label" placeholder="Feriado, mudanza, capacitación" type="text" />
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
        <SubmitButton className="w-fit" size="md">
          Guardar excepción
        </SubmitButton>
      </form>

      <form action={importHolidaysAction} className="mt-6 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-end">
        <input name="agendaDate" type="hidden" value={agendaDate} />
        <Field hint="(feriados nacionales de Argentina)" label="Año">
          <TextInput defaultValue={agendaDate.slice(0, 4)} density="sm" max={2100} min={2000} name="year" type="number" />
        </Field>
        <SubmitButton size="md" variant="ghost">
          Importar feriados
        </SubmitButton>
      </form>
    </Card>
  );
}

function formatDisplayDate(date: string): string {
  return formatWorkshopCalendarDate(date, { weekday: "long", day: "numeric", month: "long" });
}
