import type { ReactNode } from "react";
import { Card, EmptyState } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const NoSlots = () => (
  <Surface>
    <EmptyState>
      No hay horarios disponibles para este servicio y fecha. Proba con otro dia.
    </EmptyState>
  </Surface>
);

export const NoAppointments = () => (
  <Surface>
    <EmptyState>No hay turnos agendados para esta fecha.</EmptyState>
  </Surface>
);

export const InsideCard = () => (
  <Surface>
    <Card>
      <h2 className="text-2xl font-black text-white">Turnos del dia</h2>
      <EmptyState className="mt-6">No hay turnos agendados para esta fecha.</EmptyState>
    </Card>
  </Surface>
);
