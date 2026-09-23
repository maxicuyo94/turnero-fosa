/**
 * Single source for the workshop's clock. Every calendar date, instant and label shown to people is
 * built here, so the server's own time zone never leaks into a booking.
 *
 * Argentina has not observed daylight saving since 2009, so the fixed offset and the IANA zone
 * always agree; both live here so a future change touches one file.
 */
export const WORKSHOP_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const WORKSHOP_LOCALE = "es-AR";
const WORKSHOP_UTC_OFFSET = "-03:00";
const DAY_MS = 86_400_000;

/** Calendar date at the workshop (`YYYY-MM-DD`), independent of the server's time zone. */
export function workshopDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKSHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** The instant a workshop wall-clock `HH:mm` happens on a workshop calendar date. */
export function workshopInstant(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time}:00${WORKSHOP_UTC_OFFSET}`);
}

/** Half-open `[start, end)` interval covering one workshop calendar day. */
export function workshopDayBounds(date: string): { start: Date; end: Date } {
  const start = workshopInstant(date);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Workshop wall-clock time as `HH:mm`, 24-hour. */
export function workshopTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: WORKSHOP_TIME_ZONE,
  }).format(new Date(date));
}

/** Formats an instant in the workshop's zone and locale. */
export function formatWorkshopDateTime(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(WORKSHOP_LOCALE, { ...options, timeZone: WORKSHOP_TIME_ZONE }).format(new Date(date));
}

/**
 * Formats a calendar date (`YYYY-MM-DD`). Noon keeps the label on the same day whatever the zone,
 * so a date never renders as the day before.
 */
export function formatWorkshopCalendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return formatWorkshopDateTime(workshopInstant(date, "12:00"), options);
}

/** Upper-cases the first letter the way the workshop's locale does, for labels such as weekdays. */
export function capitalizeLabel(value: string): string {
  return value.charAt(0).toLocaleUpperCase(WORKSHOP_LOCALE) + value.slice(1);
}
