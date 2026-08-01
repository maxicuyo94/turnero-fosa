import type { ReactNode } from "react";
import { DetailList } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const AppointmentSummary = () => (
  <Surface>
    <DetailList
      items={[
        { term: "Servicio", description: "Service Esencial" },
        { term: "Fecha y horario", description: "6 de julio de 2026, 09:00 a 09:30" },
      ]}
    />
  </Surface>
);

export const SingleColumn = () => (
  <Surface>
    <DetailList
      columns={1}
      items={[
        { term: "Servicio", description: "Cambio de aceite y filtro" },
        { term: "Duracion", description: "45 minutos" },
        { term: "Estado", description: "Confirmado" },
      ]}
    />
  </Surface>
);
