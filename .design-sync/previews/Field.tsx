import type { ReactNode } from "react";
import { Field, Select, Textarea, TextInput } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const WithTextInput = () => (
  <Surface>
    <Field label="Nombre y apellido">
      <TextInput name="fullName" required />
    </Field>
  </Surface>
);

export const WithHint = () => (
  <Surface>
    <Field hint="(minutos, 0-10080)" label="Aviso minimo">
      <TextInput defaultValue={120} name="minimumNoticeMinutes" type="number" />
    </Field>
  </Surface>
);

export const WithSelect = () => (
  <Surface>
    <Field label="Servicio">
      <Select defaultValue="oil" name="serviceId">
        <option value="oil">Service Esencial - 60 min</option>
        <option value="brakes">Revision de frenos - 45 min</option>
      </Select>
    </Field>
  </Surface>
);

export const WithTextarea = () => (
  <Surface>
    <Field label="Comentario o reparacion puntual a revisar">
      <Textarea name="notes" />
    </Field>
  </Surface>
);

export const FormGrid = () => (
  <Surface>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Marca de la moto">
        <TextInput defaultValue="Honda" name="brand" />
      </Field>
      <Field label="Modelo">
        <TextInput defaultValue="XR 150" name="model" />
      </Field>
    </div>
  </Surface>
);
