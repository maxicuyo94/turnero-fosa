import type { ReactNode } from "react";
import { Button, Card, Field, PageHeading, PageShell, TextInput } from "turnero-fosa";

/* PageShell is a layout container — it sets the column width and gutters but
   paints no background of its own. Without the brand surface behind it the
   white headings render invisible, so every story supplies one. */
const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-charcoal-950">{children}</div>
);

export const BookingWidth = () => (
  <Surface>
    <PageShell>
      <PageHeading eyebrow="Turnos online" title="Reservar turno" />
      <Card className="mt-8">
        <h2 className="text-2xl font-black text-white">Servicio y fecha</h2>
        <p className="mt-2 text-sm text-zinc-500">Service Esencial · 60 min · 4 horarios</p>
      </Card>
    </PageShell>
  </Surface>
);

export const NarrowCentered = () => (
  <Surface>
    <PageShell centered width="sm">
      <PageHeading
        description="Ingresa para gestionar la agenda del taller."
        eyebrow="Acceso interno"
        title="Acceso interno"
      />
      <Card className="mt-8">
        <form className="grid gap-4">
          <Field label="Email">
            <TextInput name="email" type="email" />
          </Field>
          <Button size="md" type="submit">
            Ingresar
          </Button>
        </form>
      </Card>
    </PageShell>
  </Surface>
);

export const TrackingWidth = () => (
  <Surface>
    <PageShell width="lg">
      <PageHeading
        description="Ingresa el codigo que recibiste al reservar para ver el estado actual."
        eyebrow="Seguimiento"
        title="Consultar turno"
      />
    </PageShell>
  </Surface>
);
