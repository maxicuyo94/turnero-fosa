"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { EmptyState } from "@/src/components/ui";
import { capitalizeLabel, formatWorkshopCalendarDate } from "@/src/lib/workshop-date";

type Selection = { startTime: string; serviceName: string; date: string; durationMinutes: number };
const SelectionContext = createContext<Selection | null>(null);

export function BookingForm({ action, serviceName, date, durationMinutes, children }: {
  action?: (formData: FormData) => void | Promise<void>;
  serviceName: string;
  date: string;
  durationMinutes: number;
  children: ReactNode;
}) {
  const [startTime, setStartTime] = useState("");
  return (
    <SelectionContext.Provider value={{ startTime, serviceName, date, durationMinutes }}>
      <form action={action} className="mt-5 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]" onChange={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.name === "startTime") setStartTime(event.target.value);
      }}>
        {children}
      </form>
    </SelectionContext.Provider>
  );
}

export function BookingCustomerDetails({ children }: { children: ReactNode }) {
  const selection = useContext(SelectionContext);
  return selection?.startTime ? children : (
    <EmptyState className="mt-5">Elegí un horario para completar tus datos y confirmar la solicitud.</EmptyState>
  );
}

export function BookingSelectionSummary() {
  const selection = useContext(SelectionContext);
  if (!selection?.startTime) return null;
  const [hours, minutes] = selection.startTime.split(":").map(Number);
  const end = (hours * 60 + minutes + selection.durationMinutes) % 1440;
  const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return (
    <div aria-live="polite" className="mt-5 rounded-xl border border-apple-300/30 bg-apple-400/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-apple-300">Tu selección</p>
      <p className="mt-2 font-bold text-white">{selection.serviceName}</p>
      <p className="mt-1 text-sm text-zinc-300">{capitalizeLabel(formatWorkshopCalendarDate(selection.date, { weekday: "long", day: "numeric", month: "long" }))}</p>
      <p className="mt-1 font-black text-white">{selection.startTime}–{endTime} · {selection.durationMinutes} min</p>
      <p className="mt-2 text-xs text-zinc-300">Podés cambiar el horario antes de enviar la solicitud.</p>
    </div>
  );
}
