import type { ReactNode } from "react";
import { cn } from "./cn";

export type CodeDisplayProps = {
  /** Small caps caption above the code. */
  label: ReactNode;
  /** The booking reference itself, e.g. `ABCD234567`. */
  code: string;
  className?: string;
};

/**
 * Presents a customer-facing appointment code in the wide-tracked monospace
 * treatment, so it stays readable when read aloud over the phone.
 */
export function CodeDisplay({ label, code, className }: CodeDisplayProps) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-black tracking-[0.16em] text-white")}>{code}</p>
    </div>
  );
}
