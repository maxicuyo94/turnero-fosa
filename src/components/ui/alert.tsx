import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "success" | "danger" | "info";

export type AlertProps = {
  tone?: AlertTone;
  className?: string;
  children: ReactNode;
};

const toneClasses: Record<AlertTone, string> = {
  success: "border-apple-400/40 bg-apple-400/10 text-apple-100",
  danger: "border-red-300/20 bg-red-400/10 text-red-100",
  info: "border-white/10 bg-white/[0.04] text-zinc-300",
};

/**
 * Inline feedback banner. `success` confirms a booking, `danger` reports a
 * rejected lookup or bad credentials. The ARIA role follows the tone, so screen
 * readers announce errors assertively.
 */
export function Alert({ tone = "info", className, children }: AlertProps) {
  return (
    <div
      className={cn("rounded-2xl border p-5", toneClasses[tone], className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
