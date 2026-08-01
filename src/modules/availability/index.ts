import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";
import type { ScheduleBreak, ScheduleDateException, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

/** Availability only needs the opening decision of an exception, not its provenance metadata. */
export type AvailabilityDateException = Pick<ScheduleDateException, "date" | "isOpen" | "opensAt" | "closesAt">;

export type ExistingAppointment = {
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
};

export type AvailableSlot = {
  startAt: Date;
  endAt: Date;
  startTime: string;
  remainingCapacity: number;
};

type AvailabilityInput = {
  settings: WorkshopSettings;
  schedules: WeeklySchedule[];
  breaks: ScheduleBreak[];
  exceptions: AvailabilityDateException[];
  date: string;
  serviceDurationMinutes: number;
  appointments: ExistingAppointment[];
  now: Date;
};

export function getAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  const dayOfWeek = dayOfWeekForDate(input.date);
  const openingHours = openingHoursForDate(input.date, dayOfWeek, input.schedules, input.exceptions);
  if (!openingHours || isOutsideBookingWindow(input.date, input.now, input.settings)) {
    return [];
  }

  const intervals = subtractBreaks([openingHours], input.breaks.filter((item) => item.dayOfWeek === dayOfWeek));

  const slots: AvailableSlot[] = [];
  for (const interval of intervals) {
    for (
      let cursor = minutesFromTime(interval.startsAt);
      cursor + input.serviceDurationMinutes <= minutesFromTime(interval.endsAt);
      cursor += input.settings.slotStepMinutes
    ) {
      const startAt = dateAtMinutes(input.date, cursor);
      const endAt = addMinutes(startAt, input.serviceDurationMinutes);
      if (startAt.getTime() < input.now.getTime() + input.settings.minimumNoticeMinutes * 60_000) {
        continue;
      }

      const overlapping = countOverlappingAppointments(input.appointments, startAt, endAt);
      if (overlapping < input.settings.capacity) {
        slots.push({
          startAt,
          endAt,
          startTime: timeFromMinutes(cursor),
          remainingCapacity: input.settings.capacity - overlapping,
        });
      }
    }
  }

  return slots;
}

export function canAcceptAppointment(input: {
  settings: Pick<WorkshopSettings, "capacity">;
  startAt: Date;
  serviceDurationMinutes: number;
  appointments: ExistingAppointment[];
}): { accepted: true; endAt: Date } | { accepted: false; reason: "CAPACITY_EXHAUSTED" } {
  const endAt = addMinutes(input.startAt, input.serviceDurationMinutes);
  const overlapping = countOverlappingAppointments(input.appointments, input.startAt, endAt);

  if (overlapping >= input.settings.capacity) {
    return { accepted: false, reason: "CAPACITY_EXHAUSTED" };
  }

  return { accepted: true, endAt };
}

export type AppointmentReservationRepository = {
  findByIdempotencyKey(key: string): Promise<AppointmentReservationResult | null>;
  withCapacityLock<T>(operation: (appointments: ExistingAppointment[]) => Promise<T>): Promise<T>;
  save(input: { idempotencyKey: string; startAt: Date; endAt: Date }): Promise<Extract<AppointmentReservationResult, { accepted: true }>>;
};

export type AppointmentReservationResult =
  | { accepted: true; appointment: { startAt: Date; endAt: Date } }
  | { accepted: false; reason: "CAPACITY_EXHAUSTED" };

export async function createAppointmentReservation(input: {
  repository: AppointmentReservationRepository;
  settings: Pick<WorkshopSettings, "capacity">;
  input: { idempotencyKey: string; startAt: Date; serviceDurationMinutes: number };
}): Promise<AppointmentReservationResult> {
  const existing = await input.repository.findByIdempotencyKey(input.input.idempotencyKey);
  if (existing) {
    return existing;
  }

  return input.repository.withCapacityLock(async (appointments) => {
    const capacity = canAcceptAppointment({
      settings: input.settings,
      startAt: input.input.startAt,
      serviceDurationMinutes: input.input.serviceDurationMinutes,
      appointments,
    });

    if (!capacity.accepted) {
      return capacity;
    }

    return input.repository.save({
      idempotencyKey: input.input.idempotencyKey,
      startAt: input.input.startAt,
      endAt: capacity.endAt,
    });
  });
}

function countOverlappingAppointments(appointments: ExistingAppointment[], startAt: Date, endAt: Date): number {
  return appointments.filter(
    (appointment) =>
      countsTowardCapacity(appointment.status) && appointment.startAt < endAt && appointment.endAt > startAt,
  ).length;
}

/**
 * A date exception replaces the recurring weekly row for that single date. Breaks and booking
 * policies still apply, so an exceptional opening never bypasses lunch, notice, or the window.
 */
function openingHoursForDate(
  date: string,
  dayOfWeek: WeeklySchedule["dayOfWeek"],
  schedules: WeeklySchedule[],
  exceptions: AvailabilityDateException[],
): { startsAt: string; endsAt: string } | null {
  const exception = exceptions.find((item) => item.date === date);
  if (exception) {
    return exception.isOpen && exception.opensAt && exception.closesAt
      ? { startsAt: exception.opensAt, endsAt: exception.closesAt }
      : null;
  }

  const schedule = schedules.find((item) => item.dayOfWeek === dayOfWeek);
  return schedule?.isOpen ? { startsAt: schedule.opensAt, endsAt: schedule.closesAt } : null;
}

function isOutsideBookingWindow(date: string, now: Date, settings: WorkshopSettings): boolean {
  const startOfRequestedDay = dateAtMinutes(date, 0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const daysAhead = Math.floor((startOfRequestedDay.getTime() - startOfToday.getTime()) / 86_400_000);
  return daysAhead < 0 || daysAhead > settings.maximumBookingWindowDays;
}

function subtractBreaks(intervals: { startsAt: string; endsAt: string }[], breaks: ScheduleBreak[]) {
  return breaks.reduce((currentIntervals, scheduleBreak) => {
    const breakStart = minutesFromTime(scheduleBreak.startsAt);
    const breakEnd = minutesFromTime(scheduleBreak.endsAt);

    return currentIntervals.flatMap((interval) => {
      const intervalStart = minutesFromTime(interval.startsAt);
      const intervalEnd = minutesFromTime(interval.endsAt);
      if (breakEnd <= intervalStart || breakStart >= intervalEnd) {
        return [interval];
      }

      return [
        { startsAt: interval.startsAt, endsAt: timeFromMinutes(breakStart) },
        { startsAt: timeFromMinutes(breakEnd), endsAt: interval.endsAt },
      ].filter((item) => item.endsAt > item.startsAt);
    });
  }, intervals);
}

function dayOfWeekForDate(date: string) {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][
    dateAtMinutes(date, 12).getDay()
  ] as WeeklySchedule["dayOfWeek"];
}

function dateAtMinutes(date: string, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(`${date}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00-03:00`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
