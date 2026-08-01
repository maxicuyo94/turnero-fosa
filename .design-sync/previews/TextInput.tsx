import type { ReactNode } from "react";
import { Field, TextInput } from "turnero-fosa";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl bg-charcoal-950 p-5">{children}</div>
);

export const Default = () => (
  <Surface>
    <TextInput defaultValue="Ada Lovelace" name="fullName" />
  </Surface>
);

export const Placeholder = () => (
  <Surface>
    <TextInput name="phone" placeholder="+54 9 11 1234-5678" />
  </Surface>
);

export const Mono = () => (
  <Surface>
    <Field label="Codigo del turno">
      <TextInput defaultValue="ABCD234567" maxLength={32} mono name="code" />
    </Field>
  </Surface>
);

export const Densities = () => (
  <Surface>
    <div className="grid gap-3">
      <TextInput defaultValue="2026-07-06" density="sm" name="date" type="date" />
      <TextInput defaultValue="Turno de la mañana" density="md" name="label" />
    </div>
  </Surface>
);
