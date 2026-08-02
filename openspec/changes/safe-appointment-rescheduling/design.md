## Context

An appointment's effective interval is stored in `startAt` and `endAt`; the selected service owns the minimum `durationMinutes`. Availability already understands recurring schedules, breaks, date exceptions, holidays, capacity, and appointment statuses that consume capacity. Internal duration extension currently updates `endAt` directly and deliberately allows overlaps. This change replaces that exception with the same safety guarantees used during booking.

## Goals / Non-goals

**Goals:**

- Change date, start time, and total duration through one protected workflow.
- Permit shortening or extending while enforcing the service minimum and slot step.
- Guarantee that the complete proposed interval fits workshop policy and available capacity.
- Prevent stale or concurrent edits from overbooking capacity.
- Preserve an auditable history and notify customers after success.

**Non-goals:**

- Changing service, customer, or motorcycle in the same operation.
- Public self-service rescheduling, automatic movement of other appointments, privileged capacity overrides, or multi-day work.
- Treating minimum notice and maximum public booking window as internal restrictions; internal staff may schedule outside public notice/window policy but must respect operational hours, breaks, closures, duration rules, and capacity.

## Scheduling invariants

For a proposed `startAt` and `durationMinutes`, the server computes `endAt` and MUST validate:

1. The appointment exists and is not completed, cancelled, or no-show.
2. Duration is an integer, is at least the current service minimum, and aligns with `slotStepMinutes`.
3. Start and end are on the same local date in `America/Argentina/Buenos_Aires`.
4. The date is open according to a date exception first, otherwise its weekly schedule.
5. The full half-open interval `[startAt, endAt)` sits inside one opening segment and does not intersect a configured break.
6. Every instant in the interval remains below configured concurrent capacity.
7. Capacity calculation ignores the appointment being edited and ignores statuses that do not consume capacity.

Back-to-back intervals are valid: an appointment ending exactly when another starts does not overlap.

## Decisions

### Central interval validator

Extract a server-side policy that validates one proposed interval and returns either the computed end time/capacity result or a typed rejection. Public slot creation and internal rescheduling should share the low-level opening-hours, break, overlap, and capacity rules while retaining different public-policy checks for notice and booking window.

### Availability preview is advisory; transaction validation is authoritative

The UI requests valid start times after date or duration changes. These options improve usability but never authorize the update. Submission repeats validation in a database transaction under a capacity lock immediately before updating the appointment.

### Exclude the current appointment

The capacity query includes all relevant appointments for the target date, then removes the edited appointment by ID before counting overlaps. Without this rule, an unchanged interval can reject itself when capacity is full.

### Atomic update and audit

The appointment update and its interval-history event are written in the same transaction. The history stores old/new `startAt` and `endAt`, `changedById`, optional reason, and creation time. Notification delivery occurs after commit and uses the existing email log/outbox boundary so delivery failure cannot roll back the appointment.

### No hidden over-capacity override in the first slice

All edits use the same capacity ceiling. Operational overrides are excluded until they have explicit permissions, mandatory reason capture, visible warnings, and audit requirements.

## Rejection model

The operation returns specific reasons suitable for UI feedback: appointment not found, terminal appointment, invalid duration, closed date, outside opening hours, break overlap, day boundary exceeded, and capacity exhausted. A stale start option that becomes unavailable must produce `CAPACITY_EXHAUSTED` without modifying the appointment.

## Migration and rollback

Add a dedicated appointment interval history model without rewriting existing appointments. Deploy its migration before enabling the action. Rollback removes the new editor/action while leaving history rows and valid intervals intact. The old unchecked extension action must not remain reachable once the new workflow ships.

## Test strategy

- Unit tests cover every invariant, exact-boundary behavior, self-exclusion, shortening, extension, and typed rejection.
- Integration tests run two concurrent attempts for the final capacity and assert at most one succeeds.
- Repository tests verify appointment and audit history commit together.
- Component tests cover date, time, duration, disabled terminal states, and rejection feedback.
- Playwright covers a successful move, a duration-only change, a holiday rejection, and a stale-capacity conflict on desktop and mobile.

