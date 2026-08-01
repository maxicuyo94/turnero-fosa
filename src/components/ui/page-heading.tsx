import type { ReactNode } from "react";
import { cn } from "./cn";

export type PageHeadingSize = "md" | "lg";

export type PageHeadingProps = {
  /** Wide-tracked lime kicker above the title. */
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Trailing slot aligned to the title baseline — usually a secondary link. */
  action?: ReactNode;
  size?: PageHeadingSize;
  className?: string;
};

const titleSizeClasses: Record<PageHeadingSize, string> = {
  md: "text-5xl",
  lg: "text-6xl md:text-7xl",
};

const descriptionSizeClasses: Record<PageHeadingSize, string> = {
  md: "max-w-2xl text-zinc-400",
  lg: "max-w-xl text-lg leading-8 text-zinc-300",
};

/**
 * The eyebrow-plus-title block that opens every screen. Keep the eyebrow to two
 * or three words — the wide letter-spacing is the brand signature.
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  size = "md",
  className,
}: PageHeadingProps) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.55em] text-apple-300">{eyebrow}</p>
      <div
        className={cn(
          "mt-4",
          action ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" : null,
        )}
      >
        <h1 className={cn("font-black tracking-[-0.05em] text-white", titleSizeClasses[size])}>
          {title}
        </h1>
        {action}
      </div>
      {description ? (
        <p className={cn("mt-4", descriptionSizeClasses[size])}>{description}</p>
      ) : null}
    </div>
  );
}
