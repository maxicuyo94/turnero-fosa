import type { DetailsHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type DisclosureProps = {
  title: string;
  description?: string;
  initiallyOpen?: boolean;
  className?: string;
  onToggle?: DetailsHTMLAttributes<HTMLDetailsElement>["onToggle"];
  children: ReactNode;
};

/** Native disclosure keeps form values mounted and supports keyboard and fragment navigation. */
export function Disclosure({ title, description, initiallyOpen, className, onToggle, children }: DisclosureProps) {
  return (
    <details className={cn("group rounded-control border border-border-subtle bg-surface-panel", className)} onToggle={onToggle} open={initiallyOpen}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-control px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block">{title}</span>
          {description ? <span className="mt-1 block text-sm font-normal text-text-muted">{description}</span> : null}
        </span>
        <span aria-hidden="true" className="text-xl text-text-muted transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-border-subtle p-4">{children}</div>
    </details>
  );
}
