"use client";

import { useState } from "react";
import { Button, Field, Select, TextInput } from "@/src/components/ui";
import type { PublicServiceRecord } from "@/src/modules/booking/service";

export type BookingSearchFormProps = {
  services: PublicServiceRecord[];
  selectedServiceId: string;
  selectedDate: string;
  selectedDurationMinutes: number;
  durationStepMinutes?: number;
  /** Solo la sesion interna puede estirar la duracion por encima de la del servicio. */
  canEditDuration?: boolean;
};

/**
 * Filtro de servicio, fecha y duracion del turno publico. Al cambiar el
 * servicio la duracion vuelve a la del servicio elegido, para no arrastrar la
 * duracion del servicio anterior en la URL.
 */
export function BookingSearchForm({
  services,
  selectedServiceId,
  selectedDate,
  selectedDurationMinutes,
  durationStepMinutes = 1,
  canEditDuration = false,
}: BookingSearchFormProps) {
  const [serviceId, setServiceId] = useState(selectedServiceId);
  const [durationMinutes, setDurationMinutes] = useState(() => String(selectedDurationMinutes));
  const selectedService = services.find((service) => service.id === serviceId);

  return (
    <form
      action="/booking"
      className={
        canEditDuration
          ? "grid gap-3 md:min-w-[38rem] md:grid-cols-[1fr_9rem_9rem_auto] md:items-end"
          : "grid gap-3 md:min-w-[29rem] md:grid-cols-[1fr_9rem_auto] md:items-end"
      }
    >
      <Field label="Servicio">
        <Select
          density="sm"
          name="serviceId"
          onChange={(event) => {
            const nextServiceId = event.target.value;
            setServiceId(nextServiceId);
            const nextService = services.find((service) => service.id === nextServiceId);
            setDurationMinutes(nextService ? String(nextService.durationMinutes) : "");
          }}
          value={serviceId}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {service.durationMinutes} min
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha">
        <TextInput defaultValue={selectedDate} density="sm" name="date" type="date" />
      </Field>
      {canEditDuration ? (
        <Field
          hint={selectedService ? `(min. ${selectedService.durationMinutes})` : undefined}
          label="Duracion total"
        >
          <TextInput
            density="sm"
            min={selectedService?.durationMinutes}
            name="durationMinutes"
            onChange={(event) => setDurationMinutes(event.target.value)}
            step={durationStepMinutes}
            type="number"
            value={durationMinutes}
          />
        </Field>
      ) : null}
      <Button type="submit">Ver</Button>
    </form>
  );
}
