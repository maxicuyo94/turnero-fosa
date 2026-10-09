import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell, SiteHeader, TabNav } from "@/src/components/ui";
import { LinkPendingSpinner } from "@/src/components/pending";
import { signOutAction } from "@/app/(internal)/internal/actions";

export type InternalNavSection = "agenda" | "settings" | "vehicles" | "shop" | "account";

const sections: { id: InternalNavSection; label: string; href: string; adminOnly?: boolean }[] = [
  { id: "agenda", label: "Agenda", href: "/internal" },
  { id: "settings", label: "Configuración", href: "/internal/settings", adminOnly: true },
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
      <PageShell compact>
        <TabNav label="Secciones del panel" variant="primary" linkComponent={Link} className="mb-6" items={sections
            .filter((section) => canManageWorkshop || !section.adminOnly)
            .map((section) => ({
              active: section.id === active,
              href: hrefs?.[section.id] ?? section.href,
              label: section.label,
              indicator: <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />,
            }))} />
        {children}
      </PageShell>
    </>
  );
}

/** Secondary tabs inside a section (e.g. Resumen / Inventario in Repuestos). */
export function InternalSubNav({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <TabNav label={label} linkComponent={Link} className="mb-6" items={items.map((item) => ({
      ...item,
      indicator: <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />,
    }))} />
  );
}

/** Contextual "back" link used by detail screens. */
export function InternalBackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link className="inline-flex min-h-11 items-center text-sm font-bold text-zinc-400 hover:text-white" href={href}>
      ← {children}
      <LinkPendingSpinner className="ml-2 inline h-3.5 w-3.5 align-[-2px]" />
    </Link>
  );
}
