import { cn } from "./cn";

export type ToggleProps = {
  checked: boolean;
  /** Required — the switch has no visible text of its own. */
  "aria-label": string;
  /** `submit` lets the switch drive a form without client JavaScript. */
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

/**
 * Two-state switch used for publishing a service to the public catalogue. It
 * renders as a plain button so it works inside a server-action form.
 */
export function Toggle({ checked, type = "submit", disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      className={cn(
        "flex h-7 w-12 items-center rounded-full p-1 transition",
        checked ? "justify-end bg-apple-400" : "justify-start bg-zinc-600",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      disabled={disabled}
      type={type}
      {...rest}
    >
      <span className="h-5 w-5 rounded-full bg-zinc-950 shadow" />
    </button>
  );
}
