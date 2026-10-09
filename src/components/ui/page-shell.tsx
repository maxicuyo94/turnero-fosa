import type { ReactNode } from "react";
import { cn } from "./cn";

export type PageShellWidth = "sm" | "md" | "lg" | "xl";

export type PageShellProps = {
  /** `sm` is the login column, `xl` the full booking and agenda layouts. */
  width?: PageShellWidth;
  /** Vertically centre the content — used by the login and cancellation pages. */
  centered?: boolean;
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

const widthClasses: Record<PageShellWidth, string> = {
  sm: "max-w-md",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

/**
 * The `<main>` wrapper every page uses: centred column, full viewport height,
 * responsive gutters.
 */
export function PageShell({ width = "xl", centered = false, compact = false, className, children }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto min-h-screen w-full px-5 sm:px-6",
        compact ? "py-5 lg:py-8" : "py-10 lg:py-12",
        widthClasses[width],
        centered && "flex flex-col justify-center",
        className,
      )}
    >
      {children}
    </main>
  );
}
