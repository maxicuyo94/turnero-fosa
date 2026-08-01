import type { ReactNode } from "react";
import { RouteCard } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const PublicEntry = () => (
  <Surface>
    <RouteCard
      actionLabel="Ir a reservar →"
      description="Elegi el servicio, la fecha y el horario que mejor te quede."
      eyebrow="Publico"
      href="/booking"
      title="Reserva tu turno online"
    />
  </Surface>
);

export const InternalEntry = () => (
  <Surface>
    <RouteCard
      actionLabel="Ingresar →"
      description="Agenda del dia, configuracion y catalogo de servicios."
      eyebrow="Internos"
      href="/internal"
      title="Gestion del taller"
    />
  </Surface>
);

export const LandingPair = () => (
  <Surface>
    <div className="grid gap-5 md:grid-cols-2">
      <RouteCard
        actionLabel="Ir a reservar →"
        description="Elegi el servicio, la fecha y el horario que mejor te quede."
        eyebrow="Publico"
        href="/booking"
        title="Reserva tu turno online"
      />
      <RouteCard
        actionLabel="Ingresar →"
        description="Agenda del dia, configuracion y catalogo de servicios."
        eyebrow="Internos"
        href="/internal"
        title="Gestion del taller"
      />
    </div>
  </Surface>
);
