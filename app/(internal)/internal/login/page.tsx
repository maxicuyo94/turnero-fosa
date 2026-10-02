import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Alert,
  Card,
  Field,
  PageHeading,
  PageShell,
  SiteHeader,
  TextInput,
} from "@/src/components/ui";
import { SubmitButton } from "@/src/components/pending";
import { TooManyLoginAttemptsError, signIn } from "@/src/lib/auth";
import { getStaffMember } from "@/src/lib/staff-access";

type InternalLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InternalLoginPage({ searchParams }: InternalLoginPageProps) {
  // The same check `requireStaff` makes: a token whose account is gone must see the form, or the
  // two pages would keep redirecting to each other.
  if (await getStaffMember()) redirect("/internal");
  const params = (await searchParams) ?? {};
  const error = stringParam(params.error);
  const notice = stringParam(params.notice);

  return (
    <>
      <SiteHeader active="internal" linkComponent={Link} />
      <PageShell centered width="sm">
        <PageHeading
          description="Ingresá para gestionar la agenda del taller."
          eyebrow="Acceso interno"
          title="Acceso interno"
        />
        <Card className="mt-8">
          <form action={loginAction} className="grid gap-4">
            <Field label="Usuario">
              <TextInput autoComplete="username" name="username" required type="text" />
            </Field>
            <Field label="Contraseña">
              <TextInput name="password" required type="password" />
            </Field>
            {notice === "password-changed" ? (
              <Alert tone="success">Contraseña actualizada. Cerramos todas las sesiones: ingresá con la nueva.</Alert>
            ) : null}
            {error === "credentials" ? (
              <Alert tone="danger">Usuario o contraseña incorrectos.</Alert>
            ) : error === "locked" ? (
              <Alert tone="danger">Demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.</Alert>
            ) : null}
            <SubmitButton size="md">
              Ingresar
            </SubmitButton>
          </form>
        </Card>
      </PageShell>
    </>
  );
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/internal",
    });
  } catch (error) {
    if (error instanceof TooManyLoginAttemptsError) redirect("/internal/login?error=locked");
    if (error instanceof AuthError) redirect("/internal/login?error=credentials");
    throw error;
  }
}
