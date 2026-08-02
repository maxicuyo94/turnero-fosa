## Purpose

Allow protected workshop operations to change an eligible appointment interval without violating scheduling policy or capacity.

## ADDED Requirements

### Requirement: Safe Appointment Rescheduling

Authorized users MUST be able to change an eligible appointment's local date, start time, and total duration as one atomic operation. The system MUST allow shortening or extending only when the duration remains at least the selected service minimum and aligns with the configured slot step.

#### Scenario: Appointment is moved to an available interval

- **GIVEN** a confirmed appointment and an available target interval inside workshop hours
- **WHEN** an authorized user submits a new date, start time, and valid duration
- **THEN** the appointment MUST use the new start and computed end time
- **AND** the previous and new intervals MUST be recorded in history.

#### Scenario: Duration-only change is accepted

- **GIVEN** an eligible appointment and sufficient capacity for its proposed complete interval
- **WHEN** an authorized user shortens or extends its duration without changing its start
- **THEN** the appointment end time MUST reflect the new duration
- **AND** its duration MUST NOT be less than the selected service minimum.

#### Scenario: Terminal appointment cannot be rescheduled

- **GIVEN** an appointment is completed, cancelled, or marked no-show
- **WHEN** an authorized user attempts to change its interval
- **THEN** the appointment and history MUST remain unchanged.

### Requirement: Atomic Rescheduling Audit

Every successful interval change MUST record the old interval, new interval, authenticated operator, timestamp, and optional reason in the same transaction as the appointment update.

#### Scenario: Interval update fails

- **GIVEN** a proposed interval violates scheduling policy or capacity
- **WHEN** the reschedule is rejected
- **THEN** neither the appointment nor its interval history MUST change
- **AND** no customer notification MUST be queued.

