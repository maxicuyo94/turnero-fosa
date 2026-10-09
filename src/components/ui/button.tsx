import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  /** Primary action, secondary action, quiet outline, or destructive confirmation. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width on narrow screens. */
  fullWidth?: boolean;
  /** Waiting on the server: shows a spinner, disables the button and marks it busy. */
  pending?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-action text-action-text enabled:hover:bg-action-hover",
  secondary: "border border-border-control bg-surface-hover text-text-primary enabled:hover:bg-white/15",
  ghost: "border border-border-subtle bg-surface-panel text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text-primary",
  danger: "border border-danger/40 bg-danger/10 text-danger enabled:hover:bg-danger/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "rounded-control px-4 py-2 text-sm",
  md: "rounded-control px-5 py-3 text-sm",
  lg: "rounded-action-lg px-6 py-3 text-base",
};

/**
 * One primary action per group; secondary and ghost lower the emphasis.
 * Danger identifies a destructive confirmation; pending blocks repeated submission.
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
        "inline-flex min-h-control items-center justify-center gap-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
