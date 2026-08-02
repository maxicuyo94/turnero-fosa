## Why

Authorized staff can currently extend an appointment without moving its start time, and that operation intentionally permits an overlap. The workshop now needs one safe edit workflow for changing date, start time, and total duration. Every proposed interval must be checked before saving so a reschedule or duration change cannot exceed configured capacity or bypass workshop hours, breaks, or closed holidays.

## What Changes

- Replace the extend-only internal control with an appointment scheduling editor for date, start time, and total duration.
- Allow duration to increase or decrease while keeping the selected service duration as the configurable minimum.
- Calculate and present valid start times for the proposed date and duration.
- Revalidate the complete proposed interval inside the write transaction, excluding the edited appointment from capacity counts.
- Reject closed dates, intervals outside opening hours, intervals crossing breaks or the local day boundary, invalid duration steps, terminal appointments, and exhausted capacity.
- Record an audit event containing the previous and new interval, authenticated operator, timestamp, and optional reason.
- Send a customer notification only after a successful interval update.

## Capabilities

### Modified Capabilities

- `appointment-management`: authorized staff can safely reschedule eligible appointments and change their effective duration.
- `booking-availability`: the same interval-validation policy protects public booking and internal appointment edits.
- `email-notifications`: successful internal schedule changes can notify the customer after persistence.

## MVP Boundaries

- The first slice edits date, start time, and duration but does not change the appointment's service, customer, or motorcycle.
- It does not automatically move other appointments, permit an override beyond capacity, or create multi-day appointments.
- It does not expose public self-service rescheduling.
- WhatsApp delivery remains a later roadmap phase.

## Impact and de-risking

The domain service, internal repository, server action, appointment drawer, notification flow, and tests will change. A small audit table migration is expected. The previous design decision that allowed internal duration extensions to overlap is superseded by this change. Deploy the migration before the UI and retain the current appointment interval fields, so rollback can remove the editor without losing valid appointment data.

