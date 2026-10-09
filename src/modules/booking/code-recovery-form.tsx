"use client";

import { useActionState } from "react";
import { Alert, Field, TextInput } from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";

export type RecoveryState = { message: string; error?: boolean };

export function CodeRecoveryForm({ action }: { action: (state: RecoveryState, formData: FormData) => Promise<RecoveryState> }) {
  const [state, formAction] = useActionState(action, { message: "" });
  return <form action={formAction} className="mt-4 grid gap-4">
    <p className="text-sm text-zinc-400">Usá el email que dejaste al reservar. Te enviaremos los códigos de tus turnos próximos. Si reservaste sin email, comunicate con el taller.</p>
    <Field label="Email de la reserva"><TextInput name="email" type="email" autoComplete="email" required maxLength={254} /></Field>
    <SubmitButton>Enviar códigos por email</SubmitButton>
    {state.message ? <Alert tone={state.error ? "danger" : "success"}>{state.message}</Alert> : null}
  </form>;
}
