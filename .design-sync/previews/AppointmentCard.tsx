import type { ReactNode } from "react";
import { AppointmentCard, Button, Field, Select } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

const StatusForm = () => (
  <form className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:min-w-52">
    <Field label="Estado">
      <Select defaultValue="PENDING_CONFIRMATION" density="sm" name="nextStatus">
        <option value="PENDING_CONFIRMATION">Pendiente</option>
        <option value="CONFIRMED">Confirmado</option>
        <option value="IN_PROGRESS">En curso</option>
        <option value="COMPLETED">Completado</option>
      </Select>
    </Field>
    <Button size="md" type="submit">
      Actualizar
    </Button>
  </form>
);

export const WithStatusControl = () => (
  <Surface>
    <AppointmentCard
      action={<StatusForm />}
      customerName="Ada Lovelace"
      meta="Honda XR 150 ABC123 · +54 9 11 1234-5678"
      notes="Prefiere que la revisen por la mañana."
      serviceName="Service Esencial"
      timeLabel="09:00-09:30 · Pendiente"
    />
  </Surface>
);

export const WithoutNotes = () => (
  <Surface>
    <AppointmentCard
      customerName="Bruno Ferrer"
      meta="Yamaha FZ 250 JKL789 · +54 9 11 5555-2020"
      serviceName="Cambio de aceite y filtro"
      timeLabel="11:30-12:00 · Confirmado"
    />
  </Surface>
);

export const Minimal = () => (
  <Surface>
    <AppointmentCard
      customerName="Carla Diaz"
      serviceName="Revision de frenos"
      timeLabel="15:00-16:00 · En curso"
    />
  </Surface>
);
