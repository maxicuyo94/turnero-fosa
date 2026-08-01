import type { ReactNode } from "react";
import { Chip } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const FeatureRow = () => (
  <Surface>
    <div className="flex flex-wrap gap-3">
      <Chip>Turnos programados</Chip>
      <Chip>Confirmacion automatica</Chip>
      <Chip>Sin cancelacion online</Chip>
    </div>
  </Surface>
);

export const Single = () => (
  <Surface>
    <Chip>Turnos programados</Chip>
  </Surface>
);
