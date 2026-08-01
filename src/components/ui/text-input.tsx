import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Renders the value in the monospace treatment used for appointment codes. */
  mono?: boolean;
  /** `sm` matches inline filter bars; `md` is the default form density. */
  density?: "sm" | "md";
};

export const inputBaseClass =
  "rounded-lg border border-white/10 bg-zinc-950 text-white outline-none transition focus:border-apple-300";

/**
 * The standard text field. Pair with `Field` for a labelled control.
 */
export function TextInput({ mono = false, density = "md", className, ...rest }: TextInputProps) {
  return (
    <input
      className={cn(
        inputBaseClass,
        density === "sm" ? "px-3 py-2" : "px-4 py-3",
        mono && "font-mono uppercase tracking-[0.14em]",
        className,
      )}
      {...rest}
    />
  );
}
