import { describe, expect, it } from "vitest";
import {
  adjacentAgendaDate,
  agendaHref,
  datesForWeek,
  parseAgendaView,
  shiftCalendarDate,
} from "@/src/modules/appointments/agenda-navigation";

describe("agenda navigation", () => {
  it("moves one day in the day view and one week in the week view", () => {
    expect(adjacentAgendaDate("2026-09-18", "day", -1)).toBe("2026-09-17");
    expect(adjacentAgendaDate("2026-09-18", "day", 1)).toBe("2026-09-19");
    expect(adjacentAgendaDate("2026-09-18", "week", -1)).toBe("2026-09-11");
    expect(adjacentAgendaDate("2026-09-18", "week", 1)).toBe("2026-09-25");
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(shiftCalendarDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftCalendarDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists Monday to Sunday for any day of the week", () => {
    const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
    expect(datesForWeek("2026-09-14")).toEqual(week);
    expect(datesForWeek("2026-09-18")).toEqual(week);
    expect(datesForWeek("2026-09-20")).toEqual(week);
    expect(datesForWeek("2026-12-31")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  });

  it("keeps the week view in links and defaults anything else to the day view", () => {
    expect(agendaHref({ date: "2026-09-18", view: "day" })).toBe("/internal?date=2026-09-18");
    expect(agendaHref({ date: "2026-09-18", view: "week" })).toBe("/internal?date=2026-09-18&view=week");
    expect(parseAgendaView("week")).toBe("week");
    expect(parseAgendaView("month")).toBe("day");
    expect(parseAgendaView(undefined)).toBe("day");
  });
});
