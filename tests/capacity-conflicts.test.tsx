import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findCapacityConflicts } from "@/src/modules/internal/capacity-conflicts";
import { CapacityWarning } from "@/src/modules/internal/capacity-warning";
import type { AppointmentStatus } from "@/src/modules/appointments/schemas";

const date = (time: string) => new Date(`2026-10-01T${time}:00-03:00`);
const appointment = (start: string, end: string, status: AppointmentStatus = "CONFIRMED") => ({ startAt: date(start), endAt: date(end), status });

describe("persistent capacity conflicts", () => {
  it("finds actual overlap and merges continuous excess while recording its peak", () => {
    const items = [appointment("09:00", "12:00"), appointment("10:00", "11:00"), appointment("10:30", "11:30")];
    expect(findCapacityConflicts(items, 1, date("08:00"))).toEqual([{ startAt: date("10:00"), endAt: date("11:30"), peak: 3 }]);
    expect(findCapacityConflicts(items, 3, date("08:00"))).toEqual([]);
  });

  it("does not count adjacent appointments as overlapping", () => {
    expect(findCapacityConflicts([appointment("09:00", "10:00"), appointment("10:00", "11:00")], 1, date("08:00"))).toEqual([]);
  });

  it("ignores elapsed and terminal appointments and clips ongoing conflicts to now", () => {
    const items = [appointment("09:00", "12:00", "IN_PROGRESS"), appointment("10:00", "11:00", "PENDING_CONFIRMATION"),
      appointment("10:00", "12:00", "CANCELLED"), appointment("10:00", "12:00", "COMPLETED"), appointment("10:00", "12:00", "NO_SHOW")];
    expect(findCapacityConflicts(items, 1, date("10:30"))).toEqual([{ startAt: date("10:30"), endAt: date("11:00"), peak: 2 }]);
    expect(findCapacityConflicts(items, 1, date("11:00"))).toEqual([]);
  });

  it("renders an actionable persistent alert and removes it when conflicts disappear", () => {
    const conflicts = [{ startAt: date("10:00"), endAt: date("11:00"), peak: 2 }];
    const { rerender } = render(<CapacityWarning capacity={1} conflicts={conflicts} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Capacidad superada");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/internal?date=2026-10-01");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<CapacityWarning capacity={2} conflicts={[]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
