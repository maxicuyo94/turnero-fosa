"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  previewAppointmentAvailabilityAction,
  rescheduleAppointmentAction,
  updateAppointmentStatusAction,
} from "@/app/(internal)/internal/actions";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  StatusBadge,
  TextInput,
} from "@/src/components/ui";
import { cn } from "@/src/components/ui/cn";
import {
  internalStatusOptions,
  statusLabel,
  type InternalAgenda,
  type InternalAppointmentRecord,
} from "@/src/modules/internal/operations";
import type { ScheduleDateException } from "@/src/modules/settings/schemas";

type AgendaMode = "day" | "week";
type StatusFilter = "ALL" | InternalAppointmentRecord["status"];

export function InternalAgendaWorkspace({
  agenda,
  weekAgendas,
  capacity,
  exceptions = [],
  slotStepMinutes = 1,
}: {
  agenda: InternalAgenda;
  weekAgendas: InternalAgenda[];
  capacity?: number;
  exceptions?: ScheduleDateException[];
  slotStepMinutes?: number;
}) {
  const [mode, setMode] = useState<AgendaMode>("day");
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
      appointment.motorcycleLabel,
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
      <section aria-label="Resumen del día" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Turnos del día" value={agenda.appointments.length} />
        <MetricCard label="Pendientes" tone={pending > 0 ? "attention" : "neutral"} value={pending} />
        <MetricCard label="Confirmados" tone="positive" value={confirmed} />
        <MetricCard
          detail={capacity ? `de ${capacity} puestos` : undefined}
          label="En curso ahora"
          tone={inProgress > 0 ? "positive" : "neutral"}
          value={inProgress}
        />
      </section>

      <Card className="mt-5 overflow-hidden" padding="none">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-apple-300">Operación diaria</p>
              <h2 className="mt-2 text-2xl font-black text-white">{formatDisplayDate(agenda.date)}</h2>
              {selectedDateException ? <DateExceptionNotice exception={selectedDateException} /> : null}
              <p className="mt-1 text-sm text-zinc-500">
                {visibleAppointments.length === agenda.appointments.length
                  ? `${agenda.appointments.length} turnos programados`
                  : `${visibleAppointments.length} de ${agenda.appointments.length} turnos visibles`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div aria-label="Vista de agenda" className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                <ViewButton active={mode === "day"} onClick={() => setMode("day")}>Día</ViewButton>
                <ViewButton active={mode === "week"} onClick={() => setMode("week")}>Semana</ViewButton>
              </div>
              <form action="/internal" className="flex items-end gap-2">
                <Field label="Ir a la fecha">
                  <TextInput defaultValue={agenda.date} density="sm" name="date" type="date" />
                </Field>
                <Button type="submit">Ver</Button>
              </form>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(11rem,0.7fr)_minmax(11rem,0.8fr)_auto] md:items-end">
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
            <Field label="Estado">
              <Select density="sm" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
                <option value="ALL">Todos</option>
                {internalStatusOptions.map((option) => (
                  <option key={option} value={option}>{capitalize(statusLabel(option))}</option>
                ))}
              </Select>
            </Field>
            <Field label="Servicio">
              <Select density="sm" onChange={(event) => setService(event.target.value)} value={service}>
                <option value="ALL">Todos</option>
                {services.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Button
              disabled={!activeFilters}
              onClick={() => {
                setQuery("");
                setStatus("ALL");
                setService("ALL");
              }}
              type="button"
              variant="ghost"
            >
              Limpiar
            </Button>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <strong className={cn(
          "text-3xl font-black",
          tone === "positive" && "text-apple-300",
          tone === "attention" && "text-amber-300",
          tone === "neutral" && "text-white",
        )}>{value}</strong>
        {detail ? <span className="pb-1 text-xs text-zinc-600">{detail}</span> : null}
      </div>
    </div>
  );
}

function ViewButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-black transition",
        active ? "bg-apple-400 text-zinc-950" : "text-zinc-500 hover:text-white",
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
            <p className="mt-1 text-xs text-zinc-600">hasta {formatTime(appointment.endAt)}</p>
          </div>
          <div className="min-w-0">
            <p className="truncate font-black text-white">{appointment.customerName}</p>
            <p className="mt-1 truncate text-sm text-zinc-400">{appointment.serviceName}</p>
            <p className="mt-1 truncate text-xs text-zinc-600">{appointment.motorcycleLabel} · {appointment.customerPhone}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <StatusBadge status={appointment.status} />
            <span aria-hidden="true" className="text-xl text-zinc-600">›</span>
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
    <div className="overflow-x-auto">
      <div className="grid min-w-[62rem] grid-cols-7 divide-x divide-white/5">
      {agendas.map((day) => {
        const appointments = day.appointments.filter(matchesFilters);
        const dateException = exceptionsByDate.get(day.date);
        return (
          <div
            className={cn(
              "min-h-96 min-w-0 p-3",
              day.date === selectedDate && "bg-apple-400/[0.035]",
              dateException && !dateException.isOpen && "bg-amber-400/[0.035]",
            )}
            key={day.date}
          >
            <div className="border-b border-white/5 pb-3 text-center">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-600">{formatWeekday(day.date)}</p>
              <p className={cn("mt-1 text-xl font-black", day.date === selectedDate ? "text-apple-300" : "text-white")}>{day.date.slice(8, 10)}</p>
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
                  <span className="flex flex-col items-start gap-2">
                    <span className="text-xs font-black text-apple-300">{formatTime(appointment.startAt)}</span>
                    <StatusBadge className="px-2 py-1 text-[0.65rem]" status={appointment.status} />
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-white">{appointment.customerName}</span>
                  <span className="mt-1 block truncate text-[0.7rem] text-zinc-600">{appointment.serviceName}</span>
                </button>
              ))}
              {appointments.length === 0 ? <p className="py-5 text-center text-xs text-zinc-700">Sin turnos</p> : null}
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

function AppointmentDrawer({
  agendaDate,
  appointment,
  onClose,
  slotStepMinutes,
}: {
  agendaDate: string;
  appointment: InternalAppointmentRecord;
  onClose: () => void;
  slotStepMinutes: number;
}) {
  const currentDuration = durationMinutes(appointment.startAt, appointment.endAt);
  const appointmentDate = formatInputDate(appointment.startAt);
  const currentStartTime = formatInputTime(appointment.startAt);
  const [targetDate, setTargetDate] = useState(appointmentDate);
  const [duration, setDuration] = useState(currentDuration);
  const [startTime, setStartTime] = useState(currentStartTime);
  const [availableSlots, setAvailableSlots] = useState<Array<{ startTime: string; endTime: string; remainingCapacity: number }>>([
    { startTime: currentStartTime, endTime: formatInputTime(appointment.endAt), remainingCapacity: 1 },
  ]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const previewRequest = useRef(0);

  const refreshAvailability = useCallback(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(targetDate) || !Number.isInteger(duration) || duration <= 0) {
      setAvailableSlots([]);
      setPreviewMessage("Completa una fecha y una duracion validas.");
      return;
    }
    const request = previewRequest.current + 1;
    previewRequest.current = request;
    startPreviewTransition(async () => {
      try {
        const result = await previewAppointmentAvailabilityAction({
          appointmentId: appointment.id,
          date: targetDate,
          durationMinutes: duration,
        });
        if (request !== previewRequest.current) return;
        if (!result.accepted) {
          setAvailableSlots([]);
          setPreviewMessage(result.message);
          return;
        }
        setAvailableSlots(result.slots);
        setPreviewMessage(result.slots.length === 0 ? "No hay horarios disponibles para esa fecha y duracion." : null);
        setStartTime((current) => result.slots.some((slot) => slot.startTime === current)
          ? current
          : result.slots[0]?.startTime ?? "");
      } catch {
        if (request !== previewRequest.current) return;
        setAvailableSlots([]);
        setPreviewMessage("No pudimos consultar los horarios. Intenta nuevamente.");
      }
    });
  }, [appointment.id, duration, targetDate]);

  useEffect(() => {
    const timeout = window.setTimeout(refreshAvailability, 150);
    return () => window.clearTimeout(timeout);
  }, [refreshAvailability]);

  const selectedSlot = availableSlots.find((slot) => slot.startTime === startTime);

  return (
    <div aria-label="Detalle del turno" aria-modal="true" className="fixed inset-0 z-50 flex justify-end" role="dialog">
      <button aria-label="Cerrar detalle" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} type="button" />
      <aside className="relative h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-charcoal-950 p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-apple-300">Detalle del turno</p>
            <h2 className="mt-2 text-2xl font-black text-white">{appointment.customerName}</h2>
          </div>
          <Button aria-label="Cerrar detalle" onClick={onClose} type="button" variant="ghost">Cerrar</Button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-white">{formatTime(appointment.startAt)}–{formatTime(appointment.endAt)}</p>
              <p className="mt-1 text-sm text-zinc-500">{appointment.serviceName}</p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
        </div>

        <dl className="mt-6 grid gap-4 rounded-2xl border border-white/10 p-5 sm:grid-cols-2">
          <Detail className="sm:col-span-2" label="Código público" value={appointment.publicCode} />
          <Detail label="Teléfono" value={appointment.customerPhone} />
          <Detail label="Email" value={appointment.customerEmail ?? "No informado"} />
          <Detail className="sm:col-span-2" label="Moto / patente" value={appointment.motorcycleLabel} />
          <Detail className="sm:col-span-2" label="Notas" value={appointment.notes || "Sin notas"} />
        </dl>

        <form action={updateAppointmentStatusAction} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <input name="appointmentId" type="hidden" value={appointment.id} />
          <input name="date" type="hidden" value={appointmentDate || agendaDate} />
          <Field label="Cambiar estado">
            <Select defaultValue={appointment.status} density="sm" name="nextStatus">
              {statusOptionsFor(appointment.status).map((option) => (
                <option key={option} value={option}>{capitalize(statusLabel(option))}</option>
              ))}
            </Select>
          </Field>
          <Button className="mt-4" disabled={isTerminalStatus(appointment.status)} size="md" type="submit">Actualizar estado</Button>
        </form>

        <form action={rescheduleAppointmentAction} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <input name="appointmentId" type="hidden" value={appointment.id} />
          <input name="agendaDate" type="hidden" value={agendaDate} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nueva fecha">
              <TextInput
                disabled={isTerminalStatus(appointment.status)}
                name="targetDate"
                onChange={(event) => setTargetDate(event.target.value)}
                type="date"
                value={targetDate}
              />
            </Field>
            <Field hint={isPreviewPending ? "(consultando...)" : undefined} label="Horario disponible">
              <Select
                disabled={isTerminalStatus(appointment.status) || isPreviewPending || availableSlots.length === 0}
                name="startTime"
                onChange={(event) => setStartTime(event.target.value)}
                value={startTime}
              >
                {availableSlots.map((slot) => (
                  <option key={slot.startTime} value={slot.startTime}>
                    {slot.startTime}–{slot.endTime} · {slot.remainingCapacity} lugar{slot.remainingCapacity === 1 ? "" : "es"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field className="mt-4" hint={`(mínimo ${appointment.serviceDurationMinutes} min)`} label="Duración total">
            <TextInput
              disabled={isTerminalStatus(appointment.status)}
              min={appointment.serviceDurationMinutes}
              name="durationMinutes"
              onChange={(event) => setDuration(Number(event.target.value))}
              step={slotStepMinutes}
              type="number"
              value={duration}
            />
          </Field>
          <Field className="mt-4" hint="(opcional)" label="Motivo del cambio">
            <TextInput disabled={isTerminalStatus(appointment.status)} name="reason" placeholder="Ej. solicitado por el cliente" />
          </Field>
          {previewMessage ? <p className="mt-4 text-sm font-bold text-amber-200" role="status">{previewMessage}</p> : null}
          {selectedSlot ? (
            <p className="mt-4 rounded-xl border border-apple-400/20 bg-apple-400/5 p-3 text-sm text-zinc-300">
              Intervalo final: <strong className="text-white">{targetDate} · {selectedSlot.startTime}–{selectedSlot.endTime}</strong>
            </p>
          ) : null}
          <p className="mt-4 text-xs text-zinc-500">Al guardar se vuelve a verificar horarios, descansos, feriados y capacidad dentro de la transaccion.</p>
          <Button className="mt-4" disabled={isTerminalStatus(appointment.status) || isPreviewPending || !selectedSlot} size="md" type="submit">Guardar reprogramación</Button>
        </form>

        {appointment.intervalHistory.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-white/10 p-5">
            <h3 className="text-sm font-black text-white">Historial de reprogramaciones</h3>
            <ol className="mt-4 grid gap-4">
              {appointment.intervalHistory.map((item) => (
                <li className="border-l-2 border-apple-400/30 pl-3 text-xs text-zinc-400" key={item.id}>
                  <p className="font-bold text-zinc-200">{formatInterval(item.previousStartAt, item.previousEndAt)} → {formatInterval(item.newStartAt, item.newEndAt)}</p>
                  <p className="mt-1">{item.changedByName ?? "Sistema"} · {formatDateTime(item.changedAt)}</p>
                  {item.reason ? <p className="mt-1 text-zinc-500">{item.reason}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-black uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className="mt-1 break-words text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date));
}

function formatDisplayDate(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  const formatted = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
  return capitalize(formatted);
}

function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date(`${date}T12:00:00-03:00`))
    .replace(".", "");
}

function durationMinutes(startAt: Date, endAt: Date): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
}

function formatInputDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date));
}

function formatInputTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date));
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date));
}

function formatInterval(startAt: Date, endAt: Date): string {
  return `${formatInputDate(startAt)} ${formatTime(startAt)}–${formatTime(endAt)}`;
}

function statusOptionsFor(status: InternalAppointmentRecord["status"]): InternalAppointmentRecord["status"][] {
  const transitions: Record<InternalAppointmentRecord["status"], InternalAppointmentRecord["status"][]> = {
    PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
    CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  return [status, ...transitions[status]];
}

function isTerminalStatus(status: InternalAppointmentRecord["status"]): boolean {
  return ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status);
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("es-AR") + value.slice(1);
}
