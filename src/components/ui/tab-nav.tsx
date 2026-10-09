import type { ReactNode } from "react";
import { cn } from "./cn";
import type { LinkComponent } from "./link-component";

export type TabNavItem = {
  label: ReactNode;
  href: string;
  active: boolean;
  indicator?: ReactNode;
};

export type TabNavProps = {
  label: string;
  items: TabNavItem[];
  variant?: "primary" | "secondary";
  linkComponent?: LinkComponent;
  className?: string;
};

/** Route navigation uses links and aria-current; it is not an in-page ARIA tab widget. */
export function TabNav({ label, items, variant = "secondary", linkComponent, className }: TabNavProps) {
  const Link = linkComponent ?? "a";
  const primary = variant === "primary";
  return (
    <nav aria-label={label} className={cn(
      "min-w-0 border-b border-border-subtle",
      primary ? "flex flex-wrap gap-1" : "grid grid-cols-2 gap-x-4 sm:flex sm:flex-wrap sm:gap-x-6",
      className,
    )}>
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-control items-center border-b-2 py-3 text-sm transition-colors",
            primary ? "px-3 font-bold sm:px-5" : "px-2 font-semibold",
            item.active ? "border-action text-text-primary" : "border-transparent text-text-muted hover:border-border-control hover:text-text-primary",
          )}
          href={item.href}
          key={item.href}
        >
          {item.label}
          {item.indicator}
        </Link>
      ))}
    </nav>
  );
}
