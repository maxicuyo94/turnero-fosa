import type { ReactNode } from "react";
import { Button, Card, Field, TextInput } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const SectionPanel = () => (
  <Surface>
    <Card>
      <h2 className="text-2xl font-black text-white">Horarios disponibles</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Los cupos quedan sujetos a la politica actual del taller.
      </p>
    </Card>
  </Surface>
);

export const WithForm = () => (
  <Surface>
    <Card>
      <h2 className="text-2xl font-black text-white">Configuracion del taller</h2>
      <form className="mt-6 grid gap-4">
        <Field hint="(1-20)" label="Capacidad simultanea">
          <TextInput defaultValue={3} name="capacity" type="number" />
        </Field>
        <Button className="mt-1 w-fit" size="md" type="submit">
          Guardar cambios
        </Button>
      </form>
    </Card>
  </Surface>
);

export const CompactPadding = () => (
  <Surface>
    <Card padding="sm">
      <p className="text-sm text-zinc-300">
        Panel compacto — se usa para barras de accion y formularios de una sola linea.
      </p>
    </Card>
  </Surface>
);
