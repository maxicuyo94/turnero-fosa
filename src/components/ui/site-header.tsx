import { cn } from "./cn";
import type { LinkComponent } from "./link-component";
import { Button } from "./button";

export type SiteHeaderSection = "home" | "booking" | "internal";

export type SiteHeaderProps = {
  /** Which nav entry gets the lime underline. */
  active?: SiteHeaderSection;
  /** Shown to the right of the nav when an internal user is signed in. */
  userName?: string | null;
  /** Turns the user name into a link to the signed-in user's account page. */
  accountHref?: string;
  /** Renders the sign-out form when provided. */
  onSignOut?: () => void | Promise<void>;
  brand?: string;
  linkComponent?: LinkComponent;
  className?: string;
};

/**
 * Sticky product chrome: the rotated lime mark, the brand wordmark, and the
 * top-level destinations, with a separate context for workshop staff.
 */
export function SiteHeader({
  active,
  userName,
  accountHref,
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
        <Link className="flex min-h-11 items-center gap-3 text-lg font-black text-white" href={active === "internal" ? "/internal" : "/"}>
          <span className="h-6 w-6 rotate-45 rounded-md bg-apple-400" />
          <span>{brand}{active === "internal" ? <span className="block text-xs font-normal text-zinc-400">Panel del taller</span> : null}</span>
        </Link>
        <nav aria-label="Navegación principal" className="flex w-full items-center justify-between gap-2 text-sm text-zinc-300 sm:w-auto sm:justify-start sm:gap-5">
          {active === "internal" ? (
            <Link className={navClass(false)} href="/">Ver sitio público</Link>
          ) : <>
          <Link aria-current={active === "home" ? "page" : undefined} className={navClass(active === "home")} href="/">
            Inicio
          </Link>
          <Link aria-current={active === "booking" ? "page" : undefined} className={navClass(active === "booking")} href="/booking">
            Reservar
          </Link>
          <Link className={navClass(false)} href="/internal">
            Acceso al taller
          </Link>
          </>}
          {userName && accountHref ? (
            <Link className="hidden min-h-11 items-center text-zinc-400 transition hover:text-white sm:inline-flex" href={accountHref} title="Mi cuenta">
              {userName}
            </Link>
          ) : userName ? (
            <span className="hidden text-zinc-400 sm:inline">{userName}</span>
          ) : null}
          {onSignOut ? (
            <form action={onSignOut}>
              <Button variant="ghost" type="submit">
                Salir
              </Button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function navClass(isActive: boolean): string {
  return cn("inline-flex min-h-11 items-center border-b-2 px-1 py-2 transition", isActive ? "border-apple-400 text-white" : "border-transparent hover:text-white");
}
