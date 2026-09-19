/** How the internal agenda lays out its dates; kept in the URL so navigation and redirects preserve it. */
export type AgendaView = "day" | "week";

export function parseAgendaView(value: unknown): AgendaView {
  return value === "week" ? "week" : "day";
}

/** Moves a `YYYY-MM-DD` calendar date by whole days, independent of time zones and DST. */
export function shiftCalendarDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday to Sunday of the week that contains `date`. */
export function datesForWeek(date: string): string[] {
  const daysSinceMonday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = shiftCalendarDate(date, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDate(monday, index));
}

/** One step back or forward: a day in the day view, a week in the week view. */
export function adjacentAgendaDate(date: string, view: AgendaView, direction: -1 | 1): string {
  return shiftCalendarDate(date, direction * (view === "week" ? 7 : 1));
}

/** The day view is the default, so it stays out of the URL. */
export function agendaHref(input: { date: string; view: AgendaView }): string {
  const params = new URLSearchParams({ date: input.date });
  if (input.view === "week") params.set("view", "week");
  return `/internal?${params.toString()}`;
}
