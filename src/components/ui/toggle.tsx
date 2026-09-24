import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ToggleProps = {
  checked: boolean;
  /** Required — the switch has no visible text of its own. */
  "aria-label": string;
  /** `submit` lets the switch drive a form without client JavaScript. */
  type?: "button" | "submit";
  disabled?: boolean;
  /** Waiting on the server: the knob turns into a spinner and the switch is disabled. */
  pending?: boolean;
  className?: string;
};

/**
 * Two-state switch used for publishing a service to the public catalogue. It
 * renders as a plain button so it works inside a server-action form.
 */
export function Toggle({ checked, type = "submit", disabled, pending = false, className, ...rest }: ToggleProps) {
  return (
    <button
      className={cn(
        "flex h-7 w-12 items-center rounded-full p-1 transition",
        checked ? "justify-end bg-apple-400" : "justify-start bg-zinc-600",
        (disabled || pending) && "cursor-not-allowed opacity-60",
        pending && "cursor-wait",
        className,
      )}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      type={type}
      {...rest}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950 text-apple-300 shadow">
        {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
      </span>
    </button>
  );
}
