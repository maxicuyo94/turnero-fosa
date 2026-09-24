"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  previewAppointmentAvailabilityAction,
  rescheduleAppointmentAction,
  updateAppointmentStatusAction,
} from "@/app/(internal)/internal/actions";
import { Button, Field, Select, Spinner, StatusBadge, TextInput } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { capitalizeLabel, formatWorkshopDateTime, workshopDate, workshopTime } from "@/src/lib/workshop-date";
import type { AgendaView } from "@/src/modules/appointments/agenda-navigation";
import {
  allowedNextStatuses,
  isTerminalStatus,
  statusLabel,
  type InternalAppointmentRecord,
} from "@/src/modules/appointments/operations";

/** Side panel for one appointment: details, status change, rescheduling and its interval history. */
export function AppointmentDrawer({
  agendaDate,
  agendaView,
  appointment,
  onClose,
  slotStepMinutes,
}: {
  agendaDate: string;
  agendaView: AgendaView;
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
      setPreviewMessage("Completá una fecha y una duración válidas.");
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
        setPreviewMessage(result.slots.length === 0 ? "No hay horarios disponibles para esa fecha y duración." : null);
        setStartTime((current) => result.slots.some((slot) => slot.startTime === current)
          ? current
          : result.slots[0]?.startTime ?? "");
      } catch {
        if (request !== previewRequest.current) return;
        setAvailableSlots([]);
        setPreviewMessage("No pudimos consultar los horarios. Intentá nuevamente.");
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
          <div className="sm:col-span-2">
            <Detail label="Vehículo / patente" value={appointment.vehicleLabel} />
            <Link
              className="mt-1 inline-block text-sm text-lime-300 underline"
              href={`/internal/vehicles/${appointment.vehicleId}`}
            >
              Ver historial de la unidad
            </Link>
          </div>
          <Detail className="sm:col-span-2" label="Notas" value={appointment.notes || "Sin notas"} />
        </dl>

        <form action={updateAppointmentStatusAction} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <input name="appointmentId" type="hidden" value={appointment.id} />
          <input name="date" type="hidden" value={appointmentDate || agendaDate} />
          <input name="view" type="hidden" value={agendaView} />
          <Field label="Cambiar estado">
            <Select defaultValue={appointment.status} density="sm" name="nextStatus">
              {statusOptionsFor(appointment.status).map((option) => (
                <option key={option} value={option}>{capitalizeLabel(statusLabel(option))}</option>
              ))}
            </Select>
          </Field>
          <SubmitButton className="mt-4" disabled={isTerminalStatus(appointment.status)} size="md">Actualizar estado</SubmitButton>
        </form>

        <form action={rescheduleAppointmentAction} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <input name="appointmentId" type="hidden" value={appointment.id} />
          <input name="agendaDate" type="hidden" value={agendaDate} />
          <input name="view" type="hidden" value={agendaView} />
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
            <Field hint={isPreviewPending ? <span className="inline-flex items-center gap-1"><Spinner className="h-3 w-3" />consultando…</span> : undefined} label="Horario disponible">
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
          <p className="mt-4 text-xs text-zinc-500">Al guardar se vuelve a verificar horarios, descansos, feriados y capacidad dentro de la transacción.</p>
          <SubmitButton className="mt-4" disabled={isTerminalStatus(appointment.status) || isPreviewPending || !selectedSlot} size="md">Guardar reprogramación</SubmitButton>
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

const formatTime = workshopTime;
const formatInputDate = workshopDate;
const formatInputTime = workshopTime;

function durationMinutes(startAt: Date, endAt: Date): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
}

function formatDateTime(date: Date): string {
  return formatWorkshopDateTime(date, { dateStyle: "short", timeStyle: "short" });
}

function formatInterval(startAt: Date, endAt: Date): string {
  return `${formatInputDate(startAt)} ${formatTime(startAt)}–${formatTime(endAt)}`;
}

/** The current status first, so the select opens on it, then the transitions it allows. */
function statusOptionsFor(status: InternalAppointmentRecord["status"]): InternalAppointmentRecord["status"][] {
  return [status, ...allowedNextStatuses(status)];
}
