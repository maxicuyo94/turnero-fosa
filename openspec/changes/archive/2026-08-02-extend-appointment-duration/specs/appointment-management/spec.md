## Purpose

Allow protected workshop operations to record that an eligible appointment requires more time.

## ADDED Requirements

### Requirement: Extend Appointment Duration

Authorized users MUST be able to extend a pending-confirmation, confirmed, or in-progress appointment by choosing a greater total duration aligned to the configured slot step. The system MUST preserve the appointment start time, MUST NOT shorten an appointment, and MUST NOT extend an appointment beyond its local calendar day.

#### Scenario: Active appointment is extended

- **GIVEN** a confirmed appointment currently lasts 60 minutes
- **WHEN** an authorized user changes its total duration to 90 minutes
- **THEN** the appointment start time MUST remain unchanged
- **AND** its end time MUST move to 90 minutes after the start time
- **AND** later availability calculations MUST count the complete extended interval.

#### Scenario: Shortening is rejected

- **GIVEN** an appointment currently lasts 90 minutes
- **WHEN** an authorized user submits a total duration of 60 minutes
- **THEN** the appointment interval MUST remain unchanged
- **AND** the system MUST explain that appointments can only be extended.

#### Scenario: Terminal appointment is rejected

- **GIVEN** an appointment is completed, cancelled, or marked no-show
- **WHEN** an authorized user attempts to extend it
- **THEN** the appointment interval MUST remain unchanged.

#### Scenario: Extension crosses the local day boundary

- **GIVEN** an eligible appointment near the end of the day
- **WHEN** the requested duration would end on the next local calendar day
- **THEN** the appointment interval MUST remain unchanged.
