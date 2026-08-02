## Context

See `proposal.md` for motivation. A service owns a configurable `durationMinutes` value, while an appointment already owns `startAt` and `endAt`. Public availability checks the full appointment interval against schedules, breaks, policy limits, and concurrent capacity. The internal agenda can update status but cannot currently change the interval.

## Goals / Non-Goals

**Goals:**

- Preserve the service duration as the default and minimum duration.
- Recalculate public availability before submission when a longer duration is selected.
- Allow authorized staff to extend active appointment intervals.
- Ensure every later availability calculation accounts for the persisted extended interval.

**Non-Goals:**

- Shortening appointments, changing their start time, rescheduling, splitting work, or changing the service catalog duration.
- Automatically moving conflicting appointments or sending duration-change notifications.
- Changing working hours, breaks, capacity, notice, booking-window, cancellation, or status-transition policies.

## Decisions

### Derive effective duration without a new column

The effective duration is `(endAt - startAt)` and remains persisted through the existing appointment interval. The service duration remains the default/minimum. A separate override column was rejected because it would duplicate an interval that is already authoritative and require synchronization rules.

### Recalculate public slots from an explicit duration query

The public booking page accepts `durationMinutes` together with service and date. When omitted, it uses the selected service duration. A requested duration MUST be an integer, MUST be at least the service duration, and MUST align to the configured `slotStepMinutes`. The server calculates slots and revalidates submission using that effective duration; hidden or client-controlled values are never trusted without server validation.

### Allow internal extension only

The internal agenda submits the desired total duration. It MUST be greater than the appointment's current duration and MUST align to the configured slot step. Only pending-confirmation, confirmed, and in-progress appointments are eligible. The operation preserves `startAt` and updates only `endAt`. It does not reject an operational extension because of an already-booked overlap: the workshop must be able to record actual longer work, and subsequent availability immediately sees the new occupancy.

### Preserve scheduling invariants for new public bookings

Public slot generation continues to enforce configured working hours, breaks, minimum notice, booking window, and concurrent capacity over the complete effective interval. The final booking transaction repeats the same check to protect against stale or concurrent submissions.

## Risks / Trade-offs

- **A customer requests an excessive interval** -> Only intervals fitting a configured opening segment and its breaks produce slots; step alignment keeps choices predictable.
- **Staff extension overlaps an existing appointment** -> Preserve operational truth and expose the extended occupancy to all later availability calculations rather than silently shortening real work.
- **A stale client tampers with duration** -> Validate against the current service duration and workshop slot step both while loading slots and while creating the appointment.
- **An extended interval crosses midnight** -> Internal duration is capped at the end of the appointment's local calendar day; multi-day work is outside this change.

## Migration and Rollback

No schema migration is required. Deploy domain and UI changes together. Existing appointments keep their stored intervals. To roll back, remove the duration controls and actions; no data rollback is necessary because extended `endAt` values are valid under the previous schema.
