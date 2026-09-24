import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is the lime call-to-action; `ghost` is the low-emphasis outline. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width on narrow screens. */
  fullWidth?: boolean;
  /** Waiting on the server: shows a spinner, disables the button and marks it busy. */
  pending?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-apple-400 text-zinc-950 hover:bg-apple-300",
  ghost: "border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "rounded-lg px-4 py-2 text-sm",
  md: "rounded-xl px-5 py-3 text-sm",
  lg: "rounded-2xl px-6 py-3 text-base",
};

/**
 * The workshop's action button. Use `primary` for the single main action of a
 * form or card and `ghost` for secondary controls such as sign-out.
 */
export function Button({
  variant = "primary",
  size = "sm",
  fullWidth = false,
  className,
  children,
  type = "button",
  pending = false,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        pending && "disabled:cursor-wait",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full sm:w-fit",
        className,
      )}
      disabled={disabled || pending}
      type={type}
      {...rest}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
