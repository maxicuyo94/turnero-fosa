import type { ReactNode } from "react";
import { Toggle } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

const ServiceRow = ({
  name,
  minutes,
  isActive,
}: {
  name: string;
  minutes: number;
  isActive: boolean;
}) => (
  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-charcoal-950 px-4 py-3">
    <span>
      <span className="block font-medium text-white">{name}</span>
      <span className="mt-1 block text-xs text-zinc-500">{minutes} min</span>
    </span>
    <Toggle
      aria-label={isActive ? `Ocultar ${name}` : `Publicar ${name}`}
      checked={isActive}
      type="button"
    />
  </div>
);

export const States = () => (
  <Surface>
    <div className="flex items-center gap-5">
      <Toggle aria-label="Publicar servicio" checked type="button" />
      <Toggle aria-label="Ocultar servicio" checked={false} type="button" />
    </div>
  </Surface>
);

export const ServiceCatalogue = () => (
  <Surface>
    <div className="grid gap-3">
      <ServiceRow isActive minutes={60} name="Service Esencial" />
      <ServiceRow isActive={false} minutes={240} name="Service Deluxe" />
      <ServiceRow isActive minutes={45} name="Revision de frenos" />
    </div>
  </Surface>
);
