import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell, SiteHeader } from "@/src/components/ui";
import { signOutAction } from "@/app/(internal)/internal/actions";

export type InternalNavSection = "agenda" | "settings" | "vehicles" | "shop" | "account";

const sections: { id: InternalNavSection; label: string; href: string; adminOnly?: boolean }[] = [
  { id: "agenda", label: "Agenda", href: "/internal" },
  { id: "settings", label: "Configuración", href: "/internal?section=settings", adminOnly: true },
  { id: "vehicles", label: "Unidades", href: "/internal/vehicles" },
  { id: "shop", label: "Repuestos", href: "/internal/shop" },
  { id: "account", label: "Mi cuenta", href: "/internal/account" },
];

export type InternalShellProps = {
  active: InternalNavSection;
  signedInUserName?: string | null;
  /** Administrators only: shows the Configuración tab. */
  canManageWorkshop?: boolean;
  /** Per-section href overrides, e.g. the agenda keeping the selected date. */
  hrefs?: Partial<Record<InternalNavSection, string>>;
  children: ReactNode;
};

/** Chrome shared by every signed-in internal screen: header plus the same section tabs everywhere. */
export function InternalShell({ active, signedInUserName, canManageWorkshop = false, hrefs, children }: InternalShellProps) {
  return (
    <>
      <SiteHeader accountHref="/internal/account" active="internal" linkComponent={Link} onSignOut={signOutAction} userName={signedInUserName} />
      <PageShell>
        <nav aria-label="Secciones del panel" className="mb-8 flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap border-b border-white/10">
          {sections
            .filter((section) => canManageWorkshop || !section.adminOnly)
            .map((section) => (
              <InternalNavLink active={section.id === active} href={hrefs?.[section.id] ?? section.href} key={section.id}>
                {section.label}
              </InternalNavLink>
            ))}
        </nav>
        {children}
      </PageShell>
    </>
  );
}

/** Secondary tabs inside a section (e.g. Resumen / Inventario in Repuestos). */
export function InternalSubNav({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="mb-8 flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap">
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
            item.active ? "border-apple-400/60 bg-apple-400/10 text-white" : "border-white/10 text-zinc-400 hover:text-white"
          }`}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Contextual "back" link used by detail screens. */
export function InternalBackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link className="text-sm font-bold text-zinc-400 hover:text-white" href={href}>
      ← {children}
    </Link>
  );
}

function InternalNavLink({ active, href, children }: { active: boolean; href: string; children: string }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`border-b-2 px-4 py-3 text-sm font-black transition sm:px-5 ${
        active ? "border-apple-400 text-white" : "border-transparent text-zinc-500 hover:text-white"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
