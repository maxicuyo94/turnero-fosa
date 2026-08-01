## Purpose

Allow a public booking to reserve more time than the selected service default while preserving server-side validation.

## MODIFIED Requirements

### Requirement: Public Appointment Request

The system MUST let public users choose an active service, use its configured duration by default, optionally request a longer duration, select a slot available for that complete interval, provide customer and motorcycle data, and create an appointment using the configured confirmation mode. Every created appointment MUST have a short public code that uniquely identifies it for public status lookup.

#### Scenario: Service duration is used by default

- **GIVEN** an active service with a configured duration of 60 minutes
- **WHEN** a public user does not request a different duration
- **THEN** the appointment MUST reserve 60 minutes.

#### Scenario: Longer duration is reserved

- **GIVEN** an active service with a configured duration of 60 minutes
- **WHEN** a public user requests 90 minutes and selects a slot available for the full interval
- **THEN** the appointment MUST retain the selected start time
- **AND** its end time MUST be 90 minutes after its start time.

#### Scenario: Duration below the service default is rejected

- **GIVEN** an active service with a configured duration of 60 minutes
- **WHEN** a public user submits a duration below 60 minutes
- **THEN** no appointment MUST be created
- **AND** the user MUST be asked to select a valid duration.

#### Scenario: Extended duration is visible in public status lookup

- **GIVEN** a service with a configured duration of 60 minutes
- **AND** its appointment has been extended to 90 minutes
- **WHEN** the customer consults the appointment using its public code
- **THEN** the result MUST show a total duration of 90 minutes
- **AND** it MUST identify the appointment as extended from the 60-minute service duration.
