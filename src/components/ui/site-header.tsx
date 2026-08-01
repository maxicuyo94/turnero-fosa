import { cn } from "./cn";
import type { LinkComponent } from "./link-component";

export type SiteHeaderSection = "home" | "booking" | "internal";

export type SiteHeaderProps = {
  /** Which nav entry gets the lime underline. */
  active?: SiteHeaderSection;
  /** Shown to the right of the nav when an internal user is signed in. */
  userName?: string | null;
  /** Renders the sign-out form when provided. */
  onSignOut?: () => void | Promise<void>;
  brand?: string;
  linkComponent?: LinkComponent;
  className?: string;
};

/**
 * Sticky product chrome: the rotated lime mark, the brand wordmark, and the
 * three top-level destinations. Present on every page except the standalone
 * cancellation screen.
 */
export function SiteHeader({
  active,
  userName,
  onSignOut,
  brand = "Taller Express",
  linkComponent,
  className,
}: SiteHeaderProps) {
  const Link = linkComponent ?? "a";

  return (
    <header
      className={cn("border-b border-white/10 bg-charcoal-950/85 backdrop-blur", className)}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link className="flex items-center gap-3 text-lg font-black text-white" href="/">
          <span className="h-6 w-6 rotate-45 rounded-md bg-apple-400" />
          {brand}
        </Link>
        <nav className="flex w-full items-center justify-between gap-2 text-sm text-zinc-300 sm:w-auto sm:justify-start sm:gap-5">
          <Link className={navClass(active === "home")} href="/">
            Inicio
          </Link>
          <Link className={navClass(active === "booking")} href="/booking">
            Reservar
          </Link>
          <Link className={navClass(active === "internal")} href="/internal">
            Internos
          </Link>
          {userName ? <span className="hidden text-zinc-500 sm:inline">{userName}</span> : null}
          {onSignOut ? (
            <form action={onSignOut}>
              <button
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-400 transition hover:text-white"
                type="submit"
              >
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
