import { countsTowardCapacity, type AppointmentStatus } from "@/src/modules/appointments/schemas";

export type CapacityConflict = { startAt: Date; endAt: Date; peak: number };

/** Group equal timestamps so an end and a start never create a phantom overlap. */
export function findCapacityConflicts(
  appointments: Array<{ startAt: Date; endAt: Date; status: AppointmentStatus }>,
  capacity: number,
  now: Date,
): CapacityConflict[] {
  const events = new Map<number, number>();
  for (const appointment of appointments) {
    if (!countsTowardCapacity(appointment.status) || appointment.endAt <= now) continue;
    const start = Math.max(appointment.startAt.getTime(), now.getTime());
    const end = appointment.endAt.getTime();
    if (end <= start) continue;
    events.set(start, (events.get(start) ?? 0) + 1);
    events.set(end, (events.get(end) ?? 0) - 1);
  }
  const timeline = [...events.entries()].sort(([a], [b]) => a - b);
  const conflicts: CapacityConflict[] = [];
  let concurrent = 0;
  for (let index = 0; index < timeline.length - 1; index++) {
    const [start, delta] = timeline[index];
    concurrent += delta;
    const end = timeline[index + 1][0];
    if (concurrent <= capacity) continue;
    const previous = conflicts.at(-1);
    if (previous?.endAt.getTime() === start) {
      previous.endAt = new Date(end);
      previous.peak = Math.max(previous.peak, concurrent);
    } else {
      conflicts.push({ startAt: new Date(start), endAt: new Date(end), peak: concurrent });
    }
  }
  return conflicts;
}
