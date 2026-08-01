import type { ReactNode } from "react";
import { Card, EmptyState, SlotOption } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const SlotPicker = () => (
  <Surface>
    <div className="grid gap-3 sm:grid-cols-2">
      <SlotOption remainingCapacity={2} required startTime="09:00" />
      <SlotOption remainingCapacity={3} required startTime="09:30" />
      <SlotOption remainingCapacity={1} required startTime="10:00" />
      <SlotOption remainingCapacity={3} required startTime="10:30" />
    </div>
  </Surface>
);

export const Selected = () => (
  <Surface>
    <SlotOption defaultChecked remainingCapacity={2} startTime="09:00" />
  </Surface>
);

export const Disabled = () => (
  <Surface>
    <SlotOption disabled remainingCapacity={0} startTime="14:00" />
  </Surface>
);

export const InsidePickerCard = () => (
  <Surface>
    <Card>
      <h2 className="text-2xl font-black text-white">Horarios disponibles</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Los cupos quedan sujetos a la politica actual del taller.
      </p>
      <div className="mt-5 grid gap-3">
        <SlotOption remainingCapacity={2} startTime="11:00" />
        <SlotOption remainingCapacity={1} startTime="11:30" />
      </div>
    </Card>
  </Surface>
);

export const NoSlots = () => (
  <Surface>
    <EmptyState>
      No hay horarios disponibles para este servicio y fecha. Proba con otro dia.
    </EmptyState>
  </Surface>
);
