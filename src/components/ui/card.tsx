import type { ReactNode } from "react";
import { cn } from "./cn";

export type CardPadding = "none" | "sm" | "md";

export type CardProps = {
  id?: string;
  padding?: CardPadding;
  /** Optional accessible label when the card stands alone as a region. */
  "aria-label"?: string;
  className?: string;
  children: ReactNode;
};

const paddingClasses: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-5",
  md: "p-6",
};

/**
 * The elevated panel every screen section sits in: soft lime-tinted border on a
 * translucent surface. Wraps a `<section>`.
 */
export function Card({ padding = "md", className, children, ...rest }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-panel border border-border-subtle bg-surface-panel shadow-xl shadow-black/10",
        paddingClasses[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
