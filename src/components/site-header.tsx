import Link from "next/link";

type SiteHeaderProps = {
  active?: "home" | "booking" | "internal";
  userName?: string | null;
  onSignOut?: () => void | Promise<void>;
};

export function SiteHeader({ active, userName, onSignOut }: SiteHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-charcoal-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
        <Link className="flex items-center gap-3 text-lg font-black text-white" href="/">
          <span className="h-6 w-6 rotate-45 rounded-md bg-apple-400" />
          Taller Express
        </Link>
        <nav className="flex items-center gap-5 text-sm text-zinc-300">
          <Link className={navClass(active === "home")} href="/">Inicio</Link>
          <Link className={navClass(active === "booking")} href="/booking">Reservar</Link>
          <Link className={navClass(active === "internal")} href="/internal">Internos</Link>
          {userName ? <span className="hidden text-zinc-500 sm:inline">{userName}</span> : null}
          {onSignOut ? (
            <form action={onSignOut}>
              <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-400 transition hover:text-white" type="submit">
                Salir
              </button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function navClass(isActive: boolean): string {
  return isActive ? "border-b-2 border-apple-400 pb-2 text-white" : "transition hover:text-white";
}
