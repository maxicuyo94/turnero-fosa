import type { ReactNode } from "react";
import { cn } from "./cn";

export type CardPadding = "sm" | "md";

export type CardProps = {
  padding?: CardPadding;
  /** Optional accessible label when the card stands alone as a region. */
  "aria-label"?: string;
  className?: string;
  children: ReactNode;
};

const paddingClasses: Record<CardPadding, string> = {
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
        "rounded-[1.7rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20",
        paddingClasses[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
