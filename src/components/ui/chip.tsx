import type { ReactNode } from "react";
import { cn } from "./cn";

export type ChipProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Neutral rounded tag used for at-a-glance feature callouts under a page
 * heading. Not interactive — see `StatusBadge` for appointment state.
 */
export function Chip({ className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
