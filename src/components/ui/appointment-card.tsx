import type { ReactNode } from "react";
import { cn } from "./cn";

export type AppointmentCardProps = {
  /** Formatted slot range plus state, e.g. `09:00-09:30 · Pendiente`. */
  timeLabel: ReactNode;
  customerName: ReactNode;
  serviceName: ReactNode;
  /** Secondary line — motorcycle and phone. */
  meta?: ReactNode;
  notes?: ReactNode;
  /** Trailing slot for the status-change form. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/**
 * One row of the internal daily agenda: who is coming, for what, and the
 * controls to move the appointment along.
 */
export function AppointmentCard({
  timeLabel,
  customerName,
  serviceName,
  meta,
  notes,
  action,
  className,
  children,
}: AppointmentCardProps) {
  return (
    <article
      className={cn("rounded-2xl border border-white/10 bg-charcoal-950 p-4", className)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-apple-300">{timeLabel}</p>
          <h3 className="mt-2 text-xl font-black text-white">{customerName}</h3>
          <p className="mt-1 text-sm text-zinc-300">{serviceName}</p>
          {meta ? <p className="text-sm text-zinc-500">{meta}</p> : null}
          {notes ? <p className="mt-3 text-sm text-zinc-300">{notes}</p> : null}
          {children}
        </div>
        {action}
      </div>
    </article>
  );
}
