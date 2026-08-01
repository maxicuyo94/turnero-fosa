import type { ReactNode } from "react";
import { cn } from "./cn";

export type DetailListItem = {
  term: ReactNode;
  description: ReactNode;
};

export type DetailListProps = {
  items: DetailListItem[];
  /** Number of columns from the `sm` breakpoint up. */
  columns?: 1 | 2;
  className?: string;
};

/**
 * Definition list for summarising a booking — service, date, mechanic. Terms are
 * small caps and muted, descriptions are the emphasised value.
 */
export function DetailList({ items, columns = 2, className }: DetailListProps) {
  return (
    <dl className={cn("grid gap-5", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item, index) => (
        <div key={index}>
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {item.term}
          </dt>
          <dd className="mt-2 text-lg font-bold text-white">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
