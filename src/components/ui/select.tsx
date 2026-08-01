import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputBaseClass } from "./text-input";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  density?: "sm" | "md";
};

/**
 * Native select styled to match `TextInput`. Used for service pickers and the
 * internal appointment status control.
 */
export function Select({ density = "md", className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(inputBaseClass, density === "sm" ? "px-3 py-2" : "px-4 py-3", className)}
      {...rest}
    >
      {children}
    </select>
  );
}
