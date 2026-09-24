import { Spinner } from "@/src/components/ui";

/** Shown while a page renders on the server after a navigation, until its content arrives. */
export default function Loading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center" role="status">
      <span className="flex items-center gap-3 text-sm font-bold text-zinc-400">
        <Spinner className="h-6 w-6 text-apple-300" />
        Cargando…
      </span>
    </main>
  );
}
