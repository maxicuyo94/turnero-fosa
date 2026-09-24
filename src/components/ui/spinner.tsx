import { cn } from "./cn";

export type SpinnerProps = {
  className?: string;
  /** Read by screen readers when the spinner stands alone; omit it inside a labelled button. */
  label?: string;
};

/**
 * Small rotating ring that inherits the text colour. Use it while the page waits on the server:
 * inside a `Button` through its `pending` prop, or next to a line of text.
 */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("h-4 w-4 shrink-0 animate-spin", className)}
      fill="none"
      role={label ? "img" : undefined}
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}
