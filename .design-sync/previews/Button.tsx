import type { ReactNode } from "react";
import { Button } from "turnero-fosa";

/* The design system is dark-only, so every story sits on the brand surface —
   on the card's default white the ghost variant is invisible. */
const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const Primary = () => (
  <Surface>
    <Button size="md" type="submit">
      Solicitar turno
    </Button>
  </Surface>
);

export const Variants = () => (
  <Surface>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Actualizar</Button>
      <Button variant="ghost">Salir</Button>
    </div>
  </Surface>
);

export const Sizes = () => (
  <Surface>
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Ver</Button>
      <Button size="md">Guardar cambios</Button>
      <Button size="lg">Consultar</Button>
    </div>
  </Surface>
);

export const Disabled = () => (
  <Surface>
    <Button disabled size="md">
      Solicitar turno
    </Button>
  </Surface>
);
