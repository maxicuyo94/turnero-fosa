"use client";

import { useState } from "react";
import { Disclosure, Field, TextInput } from "@/src/components/ui";
import type { DayOfWeek, ScheduleBreak, WeeklySchedule } from "@/src/modules/settings/schemas";

export function WeeklyScheduleDay({ dayOfWeek, label, day, breaks }: {
  dayOfWeek: DayOfWeek;
  label: string;
  day?: WeeklySchedule;
  breaks: ScheduleBreak[];
}) {
  const [isOpen, setIsOpen] = useState(day?.isOpen ?? false);
  const [opensAt, setOpensAt] = useState(day?.opensAt ?? "09:00");
  const [closesAt, setClosesAt] = useState(day?.closesAt ?? "19:00");
  const [breakTimes, setBreakTimes] = useState([...breaks.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt })), { startsAt: "", endsAt: "" }]);
  const summary = isOpen
    ? `${opensAt || "Sin apertura"}–${closesAt || "Sin cierre"}${breakTimes.filter((item) => item.startsAt && item.endsAt).map((item) => ` · descanso ${item.startsAt}–${item.endsAt}`).join("")}`
    : "Cerrado";

  return (
    <Disclosure title={label} description={summary}>
      <fieldset>
        <legend className="sr-only">Horarios del {label.toLocaleLowerCase("es-AR")}</legend>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
          <Field className="sm:items-center" label="Abierto">
            <input aria-label={`${label}: abierto`} checked={isOpen} className="h-5 w-5 accent-apple-400" name={`isOpen-${dayOfWeek}`} onChange={(event) => setIsOpen(event.target.checked)} type="checkbox" value="true" />
          </Field>
          <Field label="Abre">
            <TextInput aria-label={`${label}: abre`} density="sm" name={`opensAt-${dayOfWeek}`} onChange={(event) => setOpensAt(event.target.value)} type="time" value={opensAt} />
          </Field>
          <Field label="Cierra">
            <TextInput aria-label={`${label}: cierra`} density="sm" name={`closesAt-${dayOfWeek}`} onChange={(event) => setClosesAt(event.target.value)} type="time" value={closesAt} />
          </Field>
        </div>
        <p className="mt-4 text-xs text-zinc-400">Dejá ambos extremos de un descanso vacíos para quitarlo.</p>
        <div className="mt-3 grid gap-3">
          {breakTimes.map((scheduleBreak, index) => (
            <div className="grid gap-3 sm:grid-cols-2" key={`${dayOfWeek}-break-${index}`}>
              <Field label={`Descanso ${index + 1} desde`}>
                <TextInput aria-label={`${label}: descanso ${index + 1} desde`} density="sm" name={`break-${dayOfWeek}-${index}-startsAt`} onChange={(event) => setBreakTimes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startsAt: event.target.value } : item))} type="time" value={scheduleBreak.startsAt} />
              </Field>
              <Field label={`Descanso ${index + 1} hasta`}>
                <TextInput aria-label={`${label}: descanso ${index + 1} hasta`} density="sm" name={`break-${dayOfWeek}-${index}-endsAt`} onChange={(event) => setBreakTimes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endsAt: event.target.value } : item))} type="time" value={scheduleBreak.endsAt} />
              </Field>
            </div>
          ))}
        </div>
      </fieldset>
    </Disclosure>
  );
}
