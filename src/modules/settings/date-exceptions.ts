import type { ScheduleDateException, ScheduleExceptionSource } from "@/src/modules/settings/schemas";

export type ScheduleDateExceptionRow = {
  date: Date;
  label: string | null;
  source: ScheduleExceptionSource;
  manualOverride: boolean;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

/** `ScheduleDateException.date` is a PostgreSQL DATE, so it always round-trips at UTC midnight. */
export function toExceptionDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromExceptionDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function mapScheduleDateException(row: ScheduleDateExceptionRow): ScheduleDateException {
  return {
    date: fromExceptionDate(row.date),
    label: row.label,
    source: row.source,
    manualOverride: row.manualOverride,
    isOpen: row.isOpen,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
  };
}
