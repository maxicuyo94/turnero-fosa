import type { ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Dashed placeholder for a list that came back empty — no available slots, no
 * appointments booked for the selected day.
 */
export function EmptyState({ className, children }: EmptyStateProps) {
  return (
    <p
      className={cn(
        "rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-zinc-400",
        className,
      )}
    >
      {children}
    </p>
  );
}
