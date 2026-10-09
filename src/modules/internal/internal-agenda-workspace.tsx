"use client";

import Form from "next/form";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Disclosure,
  EmptyState,
  Field,
  Select,
  StatusBadge,
  TextInput,
} from "@/src/components/ui";
import { LinkPendingSpinner, SubmitButton } from "@/src/components/pending";
import { cn } from "@/src/components/ui/cn";
import { capitalizeLabel, formatWorkshopCalendarDate, workshopTime } from "@/src/lib/workshop-date";
import {
  adjacentAgendaDate,
  agendaHref,
  datesForWeek,
  type AgendaView,
} from "@/src/modules/appointments/agenda-navigation";
import {
  internalStatusOptions,
  statusLabel,
  type InternalAgenda,
  type InternalAppointmentRecord,
} from "@/src/modules/appointments/operations";
import { AppointmentDrawer } from "@/src/modules/internal/appointment-drawer";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

type StatusFilter = "ALL" | InternalAppointmentRecord["status"];

export function InternalAgendaWorkspace({
  agenda,
  weekAgendas,
  capacity,
  exceptions = [],
  slotStepMinutes = 1,
  today = agenda.date,
  view = "day",
}: {
  agenda: InternalAgenda;
  weekAgendas: InternalAgenda[];
  capacity?: number;
  exceptions?: ScheduleDateException[];
  slotStepMinutes?: number;
  today?: string;
  view?: AgendaView;
}) {
  const [mode, setModeState] = useState<AgendaView>(view);
  const [navigatedView, setNavigatedView] = useState<AgendaView>(view);
  // The panel stays mounted while navigating, so a link that carries another view wins over the
  // view last chosen here.
  if (navigatedView !== view) {
    setNavigatedView(view);
    setModeState(view);
  }
  // Switching views needs no new data (the week is always loaded), so only the URL is updated,
  // keeping reloads, shared links and post-action redirects on the chosen view.
  const setMode = (next: AgendaView) => {
    setModeState(next);
    window.history.replaceState(null, "", agendaHref({ date: agenda.date, view: next }));
  };
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [service, setService] = useState("ALL");
  const [selectedAppointment, setSelectedAppointment] = useState<InternalAppointmentRecord | null>(null);

  const services = useMemo(
    () => Array.from(new Set(weekAgendas.flatMap((day) => day.appointments.map((item) => item.serviceName)))).sort(),
    [weekAgendas],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  const matchesFilters = (appointment: InternalAppointmentRecord) => {
    const searchable = [
      appointment.customerName,
      appointment.customerPhone,
      appointment.customerEmail ?? "",
      appointment.vehicleLabel,
      appointment.serviceName,
    ].join(" ").toLocaleLowerCase("es-AR");

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (status === "ALL" || appointment.status === status) &&
      (service === "ALL" || appointment.serviceName === service)
    );
  };
  const visibleAppointments = agenda.appointments.filter(matchesFilters);
  const activeFilters = Boolean(normalizedQuery || status !== "ALL" || service !== "ALL");
  const pending = agenda.appointments.filter((item) => item.status === "PENDING_CONFIRMATION").length;
  const confirmed = agenda.appointments.filter((item) => item.status === "CONFIRMED").length;
  const inProgress = agenda.appointments.filter((item) => item.status === "IN_PROGRESS").length;
  const exceptionsByDate = useMemo(() => new Map(exceptions.map((item) => [item.date, item])), [exceptions]);
  const selectedDateException = exceptionsByDate.get(agenda.date);

  return (
    <>
      <Card className="mt-6 overflow-hidden" padding="none">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-apple-300">Operación diaria</p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {mode === "week" ? formatWeekRange(agenda.date) : formatDisplayDate(agenda.date)}
              </h2>
              {selectedDateException ? <DateExceptionNotice exception={selectedDateException} /> : null}
              <p className="mt-1 text-sm text-zinc-400">
                {visibleAppointments.length === agenda.appointments.length
                  ? `${agenda.appointments.length} turnos programados`
                  : `${visibleAppointments.length} de ${agenda.appointments.length} turnos visibles`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <AgendaDateNavigation date={agenda.date} today={today} view={mode} />
              <div aria-label="Vista de agenda" className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                <ViewButton active={mode === "day"} onClick={() => setMode("day")}>Día</ViewButton>
                <ViewButton active={mode === "week"} onClick={() => setMode("week")}>Semana</ViewButton>
              </div>
              <Form action="/internal" className="flex items-end gap-2">
                <Field label="Ir a la fecha">
                  <TextInput defaultValue={agenda.date} density="sm" name="date" type="date" />
                </Field>
                {mode === "week" ? <input name="view" type="hidden" value="week" /> : null}
                <SubmitButton>Ver</SubmitButton>
              </Form>
            </div>
          </div>

          <section aria-label="Resumen del día" className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Turnos del día" value={agenda.appointments.length} />
            <MetricCard label="Pendientes" tone={pending > 0 ? "attention" : "neutral"} value={pending} />
            <MetricCard label="Confirmados" tone="positive" value={confirmed} />
            <MetricCard detail={capacity ? `de ${capacity} puestos` : undefined} label="En curso ahora" tone={inProgress > 0 ? "positive" : "neutral"} value={inProgress} />
          </section>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <Field label="Buscar turno">
              <TextInput
                aria-label="Buscar por cliente, teléfono, moto o patente"
                density="sm"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cliente, teléfono, moto o patente"
                type="search"
                value={query}
              />
            </Field>
            <Button disabled={!activeFilters} onClick={() => { setQuery(""); setStatus("ALL"); setService("ALL"); }} type="button" variant="ghost">Limpiar</Button>
            <Disclosure className="col-span-2" title="Filtrar por estado o servicio" initiallyOpen={status !== "ALL" || service !== "ALL"}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Estado">
                  <Select density="sm" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
                    <option value="ALL">Todos</option>
                    {internalStatusOptions.map((option) => (
                      <option key={option} value={option}>{capitalizeLabel(statusLabel(option))}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Servicio">
                  <Select density="sm" onChange={(event) => setService(event.target.value)} value={service}>
                    <option value="ALL">Todos</option>
                    {services.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                </Field>
              </div>
            </Disclosure>
          </div>
        </div>

        {mode === "day" ? (
          <DayAgenda
            appointments={visibleAppointments}
            hasActiveFilters={activeFilters}
            onSelect={setSelectedAppointment}
          />
        ) : (
          <WeekAgenda
            agendas={weekAgendas}
            exceptionsByDate={exceptionsByDate}
            matchesFilters={matchesFilters}
            onSelect={setSelectedAppointment}
            selectedDate={agenda.date}
          />
        )}
      </Card>

      {selectedAppointment ? (
        <AppointmentDrawer
          agendaDate={agenda.date}
          agendaView={mode}
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          slotStepMinutes={slotStepMinutes}
        />
      ) : null}
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: "neutral" | "positive" | "attention";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
      <p className="text-xs font-medium text-zinc-400 sm:text-sm">{label}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <strong className={cn(
          "text-2xl font-black",
          tone === "positive" && "text-apple-300",
          tone === "attention" && "text-amber-300",
          tone === "neutral" && "text-white",
        )}>{value}</strong>
        {detail ? <span className="pb-1 text-xs text-zinc-400">{detail}</span> : null}
      </div>
    </div>
  );
}

function AgendaDateNavigation({ date, today, view }: { date: string; today: string; view: AgendaView }) {
  const unit = view === "week" ? "Semana" : "Día";
  const showsToday = view === "week" ? datesForWeek(date).includes(today) : date === today;
  const linkClass = "inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-black text-zinc-400 transition hover:bg-white/[0.06] hover:text-white";
  return (
    <nav aria-label="Navegar fechas" className="flex rounded-xl border border-white/10 bg-black/20 p-1">
      <Link aria-label={`${unit} anterior`} className={linkClass} href={agendaHref({ date: adjacentAgendaDate(date, view, -1), view })}>
        ‹ Anterior
        <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />
      </Link>
      <Link
        aria-current={showsToday ? "date" : undefined}
        className={cn(linkClass, showsToday && "text-apple-300")}
        href={agendaHref({ date: today, view })}
      >
        Hoy
        <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />
      </Link>
      <Link aria-label={`${unit} siguiente`} className={linkClass} href={agendaHref({ date: adjacentAgendaDate(date, view, 1), view })}>
        Siguiente ›
        <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />
      </Link>
    </nav>
  );
}

function ViewButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-lg px-4 py-2 text-sm font-black transition",
        active ? "bg-apple-400 text-zinc-950" : "text-zinc-400 hover:text-white",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DayAgenda({
  appointments,
  hasActiveFilters,
  onSelect,
}: {
  appointments: InternalAppointmentRecord[];
  hasActiveFilters: boolean;
  onSelect: (appointment: InternalAppointmentRecord) => void;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState className="m-5 sm:m-6">
        {hasActiveFilters ? "No hay turnos que coincidan con los filtros." : "No hay turnos agendados para esta fecha."}
      </EmptyState>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {appointments.map((appointment) => (
        <button
          className="grid w-full gap-4 p-5 text-left transition hover:bg-white/[0.035] sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:p-6"
          key={appointment.id}
          onClick={() => onSelect(appointment)}
          type="button"
        >
          <div>
            <p className="text-lg font-black text-white">{formatTime(appointment.startAt)}</p>
            <p className="mt-1 text-xs text-zinc-400">hasta {formatTime(appointment.endAt)}</p>
          </div>
          <div className="min-w-0">
            <p className="truncate font-black text-white">{appointment.customerName}</p>
            <p className="mt-1 truncate text-sm text-zinc-400">{appointment.serviceName}</p>
            <p className="mt-1 truncate text-xs text-zinc-400">{appointment.vehicleLabel} · {appointment.customerPhone}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <StatusBadge status={appointment.status} />
            <span aria-hidden="true" className="text-xl text-zinc-400">›</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function WeekAgenda({
  agendas,
  selectedDate,
  exceptionsByDate,
  matchesFilters,
  onSelect,
}: {
  agendas: InternalAgenda[];
  selectedDate: string;
  exceptionsByDate: Map<string, ScheduleDateException>;
  matchesFilters: (appointment: InternalAppointmentRecord) => boolean;
  onSelect: (appointment: InternalAppointmentRecord) => void;
}) {
  return (
    <div>
      <div className="grid divide-y divide-white/10 xl:grid-cols-7 xl:divide-x xl:divide-y-0">
      {agendas.map((day) => {
        const appointments = day.appointments.filter(matchesFilters);
        const dateException = exceptionsByDate.get(day.date);
        return (
          <div
            className={cn(
              "min-w-0 p-4 xl:min-h-96 xl:p-3",
              day.date === selectedDate && "bg-apple-400/[0.035]",
              dateException && !dateException.isOpen && "bg-amber-400/[0.035]",
            )}
            key={day.date}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 xl:block xl:text-center">
              <p className="text-sm font-bold text-zinc-300 xl:text-xs xl:uppercase">
                <span className="xl:hidden">{formatDisplayDate(day.date)}</span>
                <span className="hidden xl:inline">{formatWeekday(day.date)}</span>
              </p>
              <Link
                aria-label={`Ver el día ${formatDisplayDate(day.date)}`}
                className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-lg font-black transition hover:bg-white/[0.06] xl:mt-1", day.date === selectedDate ? "text-apple-300" : "text-white")}
                href={agendaHref({ date: day.date, view: "day" })}
              >
                {day.date.slice(8, 10)}
              </Link>
              {dateException ? <DateExceptionNotice className="mt-2" compact exception={dateException} /> : null}
            </div>
            <div className="mt-3 grid gap-2">
              {appointments.map((appointment) => (
                <button
                  className="w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-apple-300/30 hover:bg-apple-400/[0.07]"
                  key={appointment.id}
                  onClick={() => onSelect(appointment)}
                  type="button"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2 xl:flex-col xl:items-start">
                    <span className="text-sm font-black text-white">{formatTime(appointment.startAt)}–{formatTime(appointment.endAt)}</span>
                    <StatusBadge className="px-2 py-1 text-xs" status={appointment.status} />
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-white">{appointment.customerName}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-400">{appointment.serviceName}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-400 xl:hidden">{appointment.vehicleLabel}</span>
                </button>
              ))}
              {appointments.length === 0 ? <p className="py-2 text-sm text-zinc-400 xl:py-5 xl:text-center xl:text-xs">Sin turnos</p> : null}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function DateExceptionNotice({
  exception,
  compact = false,
  className,
}: {
  exception: ScheduleDateException;
  compact?: boolean;
  className?: string;
}) {
  const kind = exception.isOpen ? "Horario especial" : exception.source === "IMPORTED" ? "Feriado" : "Cerrado";
  const detail = exception.label || (exception.isOpen && exception.opensAt && exception.closesAt
    ? `${exception.opensAt}–${exception.closesAt}`
    : null);

  return (
    <div className={cn(compact ? "grid justify-items-center gap-1" : "mt-2 flex flex-wrap items-center gap-2", className)}>
      <span className="w-fit rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[0.65rem] font-black text-amber-200">
        {kind}
      </span>
      {detail ? <span className={cn("text-xs text-amber-100/70", compact && "max-w-full truncate")}>{detail}</span> : null}
    </div>
  );
}

const formatTime = workshopTime;

function formatDisplayDate(date: string): string {
  return capitalizeLabel(formatWorkshopCalendarDate(date, { weekday: "long", day: "numeric", month: "long" }));
}

function formatWeekRange(date: string): string {
  const week = datesForWeek(date);
  const format = formatWorkshopCalendarDate;
  const first = week[0]!;
  const last = week[6]!;
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const start = sameMonth ? format(first, { day: "numeric" }) : format(first, { day: "numeric", month: "long" });
  return `Semana del ${start} al ${format(last, { day: "numeric", month: "long" })}`;
}

function formatWeekday(date: string): string {
  return formatWorkshopCalendarDate(date, { weekday: "short" }).replace(".", "");
}
