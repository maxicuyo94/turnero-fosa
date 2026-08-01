import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeading,
  PageShell,
  SiteHeader,
  TextInput,
} from "@/src/components/ui";
import { auth, isInternalSession, signIn } from "@/src/lib/auth";

type InternalLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InternalLoginPage({ searchParams }: InternalLoginPageProps) {
  const session = await auth();
  if (isInternalSession(session)) redirect("/internal");
  const params = (await searchParams) ?? {};
  const hasCredentialError = stringParam(params.error) === "credentials";

  return (
    <>
      <SiteHeader active="internal" linkComponent={Link} />
      <PageShell centered width="sm">
        <PageHeading
          description="Ingresa para gestionar la agenda del taller."
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
            {hasCredentialError ? (
              <Alert tone="danger">Usuario o contraseña incorrectos.</Alert>
            ) : null}
            <Button size="md" type="submit">
              Ingresar
            </Button>
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
    if (error instanceof AuthError) redirect("/internal/login?error=credentials");
    throw error;
  }
}
