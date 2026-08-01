import { cn } from "./cn";

export type AppointmentStatusValue =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type StatusBadgeProps = {
  status: AppointmentStatusValue;
  className?: string;
};

export const appointmentStatusLabels: Record<AppointmentStatusValue, string> = {
  PENDING_CONFIRMATION: "Pendiente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Ausente",
};

const statusToneClasses: Record<AppointmentStatusValue, string> = {
  PENDING_CONFIRMATION: "border-white/15 bg-white/[0.06] text-zinc-200",
  CONFIRMED: "border-apple-300/30 bg-apple-400/15 text-apple-200",
  IN_PROGRESS: "border-white/15 bg-white/[0.06] text-zinc-200",
  COMPLETED: "border-apple-300/30 bg-apple-400/15 text-apple-200",
  CANCELLED: "border-red-300/25 bg-red-400/10 text-red-200",
  NO_SHOW: "border-red-300/25 bg-red-400/10 text-red-200",
};

/**
 * Pill showing an appointment's lifecycle state, with the Spanish label the
 * workshop uses. Lime means settled, red means the slot was lost, neutral means
 * still moving.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "w-fit rounded-full border px-4 py-2 text-sm font-black",
        statusToneClasses[status],
        className,
      )}
    >
      {appointmentStatusLabels[status]}
    </span>
  );
}
