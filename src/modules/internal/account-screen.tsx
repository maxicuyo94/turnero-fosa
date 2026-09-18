"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Card, Field, PageHeading, PageShell, SiteHeader, TextInput } from "@/src/components/ui";
import { signOutAction } from "@/app/(internal)/internal/actions";
import { changePasswordAction } from "@/app/(internal)/internal/account/actions";

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  field?: "currentPassword" | "newPassword" | "confirmPassword";
};

const initialState: AccountActionState = { status: "idle" };

export function InternalAccountScreen({
  user,
  minPasswordLength,
}: {
  user: { name: string | null; username: string | null; email: string };
  minPasswordLength: number;
}) {
  const [state, action] = useActionState(changePasswordAction, initialState);
  const displayName = user.name ?? user.username ?? user.email;
  const invalid = (field: NonNullable<AccountActionState["field"]>) => state.status === "error" && state.field === field;

  return (
    <>
      <SiteHeader accountHref="/internal/account" active="internal" linkComponent={Link} onSignOut={signOutAction} userName={displayName} />
      <PageShell width="sm">
        <Link className="text-sm font-bold text-zinc-400 hover:text-white" href="/internal">← Volver al panel</Link>
        <PageHeading className="mt-7" eyebrow="Acceso interno" title="Mi cuenta" description={`Usuario ${user.username ?? user.email}`} />

        <Card className="mt-8" aria-label="Cambiar contraseña">
          <h2 className="text-2xl font-black text-white">Cambiar contraseña</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Pedimos la actual para confirmar que sos vos. La nueva debe tener al menos {minPasswordLength} caracteres.
          </p>
          {/* Tras un cambio exitoso se vacían los campos para no dejar contraseñas a la vista. */}
          <form action={action} className="mt-6 grid gap-4" key={state.status === "success" ? state.message : "form"}>
            <input autoComplete="username" className="hidden" name="username" readOnly type="text" value={user.username ?? user.email} />
            <Field label="Contraseña actual" htmlFor="current-password">
              <TextInput aria-invalid={invalid("currentPassword") || undefined} autoComplete="current-password" id="current-password" name="currentPassword" required type="password" />
            </Field>
            <Field label="Contraseña nueva" hint={`mínimo ${minPasswordLength}`} htmlFor="new-password">
              <TextInput aria-invalid={invalid("newPassword") || undefined} autoComplete="new-password" id="new-password" minLength={minPasswordLength} name="newPassword" required type="password" />
            </Field>
            <Field label="Repetir contraseña nueva" htmlFor="confirm-password">
              <TextInput aria-invalid={invalid("confirmPassword") || undefined} autoComplete="new-password" id="confirm-password" minLength={minPasswordLength} name="confirmPassword" required type="password" />
            </Field>
            <SubmitButton />
          </form>
          {state.status !== "idle" ? (
            <Alert className="mt-5" tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
          ) : null}
        </Card>
      </PageShell>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="mt-2 justify-self-start" disabled={pending} size="md" type="submit">
      {pending ? "Guardando…" : "Cambiar contraseña"}
    </Button>
  );
}
