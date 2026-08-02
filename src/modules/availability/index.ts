import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";
import type { ScheduleBreak, ScheduleDateException, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

/** Availability only needs the opening decision of an exception, not its provenance metadata. */
export type AvailabilityDateException = Pick<ScheduleDateException, "date" | "isOpen" | "opensAt" | "closesAt">;

export type ExistingAppointment = {
  id?: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
};

export type AppointmentIntervalRejection =
  | "INVALID_DURATION"
  | "CLOSED_DATE"
  | "OUTSIDE_OPENING_HOURS"
  | "BREAK_OVERLAP"
  | "DAY_BOUNDARY_EXCEEDED"
  | "CAPACITY_EXHAUSTED";

export function validateAppointmentInterval(input: {
  settings: Pick<WorkshopSettings, "capacity" | "slotStepMinutes">;
  schedules: WeeklySchedule[];
  breaks: ScheduleBreak[];
  exceptions: AvailabilityDateException[];
  date: string;
  startTime: string;
  durationMinutes: number;
  serviceMinimumDurationMinutes: number;
  appointments: ExistingAppointment[];
  excludeAppointmentId?: string;
}):
  | { accepted: true; startAt: Date; endAt: Date; remainingCapacity: number }
  | { accepted: false; reason: AppointmentIntervalRejection } {
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < input.serviceMinimumDurationMinutes ||
    input.durationMinutes % input.settings.slotStepMinutes !== 0
  ) {
    return { accepted: false, reason: "INVALID_DURATION" };
  }

  const startMinutes = minutesFromTime(input.startTime);
  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes >= 24 * 60) return { accepted: false, reason: "DAY_BOUNDARY_EXCEEDED" };

  const dayOfWeek = dayOfWeekForDate(input.date);
  const openingHours = openingHoursForDate(input.date, dayOfWeek, input.schedules, input.exceptions);
  if (!openingHours) return { accepted: false, reason: "CLOSED_DATE" };
  if (startMinutes < minutesFromTime(openingHours.startsAt) || endMinutes > minutesFromTime(openingHours.endsAt)) {
    return { accepted: false, reason: "OUTSIDE_OPENING_HOURS" };
  }

  const overlapsBreak = input.breaks
    .filter((item) => item.dayOfWeek === dayOfWeek)
    .some((item) => startMinutes < minutesFromTime(item.endsAt) && endMinutes > minutesFromTime(item.startsAt));
  if (overlapsBreak) return { accepted: false, reason: "BREAK_OVERLAP" };

  const startAt = dateAtMinutes(input.date, startMinutes);
  const endAt = addMinutes(startAt, input.durationMinutes);
  const appointments = input.excludeAppointmentId
    ? input.appointments.filter((item) => item.id !== input.excludeAppointmentId)
    : input.appointments;
  const overlapping = maximumConcurrentAppointments(appointments, startAt, endAt);
  if (overlapping >= input.settings.capacity) return { accepted: false, reason: "CAPACITY_EXHAUSTED" };

  return { accepted: true, startAt, endAt, remainingCapacity: input.settings.capacity - overlapping };
}

export type AvailableSlot = {
  startAt: Date;
  endAt: Date;
  startTime: string;
  remainingCapacity: number;
};

export function getInternalAvailableSlots(input: {
  settings: Pick<WorkshopSettings, "capacity" | "slotStepMinutes">;
  schedules: WeeklySchedule[];
  breaks: ScheduleBreak[];
  exceptions: AvailabilityDateException[];
  date: string;
  durationMinutes: number;
  serviceMinimumDurationMinutes: number;
  appointments: ExistingAppointment[];
  excludeAppointmentId: string;
}): AvailableSlot[] {
  const slots: AvailableSlot[] = [];

  for (let cursor = 0; cursor < 24 * 60; cursor += input.settings.slotStepMinutes) {
    const startTime = timeFromMinutes(cursor);
    const result = validateAppointmentInterval({ ...input, startTime });
    if (result.accepted) {
      slots.push({
        startAt: result.startAt,
        endAt: result.endAt,
        startTime,
        remainingCapacity: result.remainingCapacity,
      });
    }
  }

  return slots;
}

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

  const slots: AvailableSlot[] = [];
  for (
    let cursor = minutesFromTime(openingHours.startsAt);
    cursor + input.serviceDurationMinutes <= minutesFromTime(openingHours.endsAt);
    cursor += input.settings.slotStepMinutes
  ) {
    const startAt = dateAtMinutes(input.date, cursor);
    if (startAt.getTime() < input.now.getTime() + input.settings.minimumNoticeMinutes * 60_000) {
      continue;
    }

    const startTime = timeFromMinutes(cursor);
    const result = validateAppointmentInterval({
      settings: input.settings,
      schedules: input.schedules,
      breaks: input.breaks,
      exceptions: input.exceptions,
      date: input.date,
      startTime,
      durationMinutes: input.serviceDurationMinutes,
      serviceMinimumDurationMinutes: input.serviceDurationMinutes,
      appointments: input.appointments,
    });
    if (result.accepted) {
      slots.push({
        startAt: result.startAt,
        endAt: result.endAt,
        startTime,
        remainingCapacity: result.remainingCapacity,
      });
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
  const overlapping = maximumConcurrentAppointments(input.appointments, input.startAt, endAt);

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

function maximumConcurrentAppointments(appointments: ExistingAppointment[], startAt: Date, endAt: Date): number {
  const events = appointments
    .filter(
      (appointment) =>
        countsTowardCapacity(appointment.status) && appointment.startAt < endAt && appointment.endAt > startAt,
    )
    .flatMap((appointment) => [
      { at: Math.max(appointment.startAt.getTime(), startAt.getTime()), delta: 1 },
      { at: Math.min(appointment.endAt.getTime(), endAt.getTime()), delta: -1 },
    ])
    .sort((left, right) => left.at - right.at || left.delta - right.delta);

  let concurrent = 0;
  let maximum = 0;
  for (const event of events) {
    concurrent += event.delta;
    maximum = Math.max(maximum, concurrent);
  }
  return maximum;
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
