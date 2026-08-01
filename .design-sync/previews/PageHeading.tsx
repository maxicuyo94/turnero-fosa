import type { ReactNode } from "react";
import { PageHeading } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const Landing = () => (
  <Surface>
    <PageHeading
      description="Reserva tu turno online en segundos o gestiona la agenda del taller. Simple, rapido y sin llamadas."
      eyebrow="Taller de motos"
      size="lg"
      title="Taller de motos Express"
    />
  </Surface>
);

export const WithAction = () => (
  <Surface>
    <PageHeading
      action={
        <a
          className="font-semibold text-apple-300 underline decoration-apple-400/40 underline-offset-4"
          href="/booking/status"
        >
          Ya tengo turno
        </a>
      }
      eyebrow="Turnos online"
      title="Reservar turno"
    />
  </Surface>
);

export const WithDescription = () => (
  <Surface>
    <PageHeading
      description="Ingresa el codigo que recibiste al reservar para ver el estado actual."
      eyebrow="Seguimiento"
      title="Consultar turno"
    />
  </Surface>
);

export const TitleOnly = () => (
  <Surface>
    <PageHeading eyebrow="Gestion del taller" title="Agenda" />
  </Surface>
);
