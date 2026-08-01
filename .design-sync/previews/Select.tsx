import type { ReactNode } from "react";
import { Field, Select } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const ServicePicker = () => (
  <Surface>
    <Field label="Servicio">
      <Select defaultValue="oil" name="serviceId">
        <option value="oil">Service Esencial - 60 min</option>
        <option value="brakes">Revision de frenos - 45 min</option>
        <option value="full">Service Deluxe - 240 min</option>
      </Select>
    </Field>
  </Surface>
);

export const StatusPicker = () => (
  <Surface>
    <Field label="Estado">
      <Select defaultValue="CONFIRMED" density="sm" name="nextStatus">
        <option value="PENDING_CONFIRMATION">Pendiente</option>
        <option value="CONFIRMED">Confirmado</option>
        <option value="IN_PROGRESS">En curso</option>
        <option value="COMPLETED">Completado</option>
        <option value="NO_SHOW">Ausente</option>
      </Select>
    </Field>
  </Surface>
);
