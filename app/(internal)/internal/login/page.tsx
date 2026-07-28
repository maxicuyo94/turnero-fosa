import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/src/components/site-header";
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
      <SiteHeader active="internal" />
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-apple-300">Acceso interno</p>
        <h1 className="mt-4 text-4xl font-bold text-white">Acceso interno</h1>
        <p className="mt-3 text-zinc-300">Ingresa para gestionar la agenda del taller.</p>
        <form action={loginAction} className="mt-8 grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6">
        <label className="grid gap-2 text-sm font-medium text-zinc-300">
          Email
          <input className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" name="email" required type="email" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-300">
          Contraseña
          <input className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" name="password" required type="password" />
        </label>
        {hasCredentialError ? (
          <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
            Email o contraseña incorrectos.
          </p>
        ) : null}
        <button className="rounded-xl bg-apple-400 px-4 py-3 text-sm font-bold text-zinc-950" type="submit">Ingresar</button>
        </form>
      </main>
    </>
  );
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/internal" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/internal/login?error=credentials");
    throw error;
  }
}
