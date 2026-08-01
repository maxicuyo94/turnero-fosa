import type { ReactNode } from "react";
import { cn } from "./cn";

export type FieldProps = {
  label: ReactNode;
  /** Muted parenthetical next to the label, e.g. the accepted range. */
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Label-above-control wrapper for every form input. Renders a `<label>`, so the
 * control it wraps is associated without needing an id.
 */
export function Field({ label, hint, htmlFor, className, children }: FieldProps) {
  return (
    <label className={cn("grid gap-2 text-sm text-zinc-300", className)} htmlFor={htmlFor}>
      <span>
        {label}
        {hint ? <span className="ml-1 text-zinc-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
