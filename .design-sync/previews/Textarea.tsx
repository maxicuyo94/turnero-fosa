import type { ReactNode } from "react";
import { Field, Textarea } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const Empty = () => (
  <Surface>
    <Field label="Comentario o reparacion puntual a revisar">
      <Textarea name="notes" placeholder="Contanos que le pasa a la moto" />
    </Field>
  </Surface>
);

export const Filled = () => (
  <Surface>
    <Field label="Comentario o reparacion puntual a revisar">
      <Textarea
        defaultValue="Hace un ruido al frenar y la luz de tablero queda prendida."
        name="notes"
      />
    </Field>
  </Surface>
);
