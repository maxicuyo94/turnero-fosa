## MODIFIED Requirements

### Requirement: Valid Slot Calculation

The system MUST calculate available slots from date-specific exceptions, weekly working hours, breaks, service duration, capacity, existing appointments, minimum notice, and maximum booking window. A date-specific exception MUST take precedence over the recurring weekly schedule.

#### Scenario: Slot inside configured hours is available

- **GIVEN** capacity remains for the full selected service duration
- **WHEN** a user requests availability within working hours and policy limits
- **THEN** the slot MAY be returned as available.

#### Scenario: Closed or out-of-policy slot is rejected

- **GIVEN** a requested time is on a closed date, outside working hours, inside a break, below minimum notice, or beyond the booking window
- **WHEN** availability is calculated
- **THEN** the slot MUST NOT be returned.

#### Scenario: Imported Argentine holiday is closed

- **GIVEN** a national holiday is stored as a closed date exception
- **WHEN** a user requests availability for that date
- **THEN** no slots MUST be returned.

#### Scenario: Exception opens a normally closed date

- **GIVEN** an authorized user configured a date as exceptionally open with valid hours
- **WHEN** capacity and policy constraints allow a requested service
- **THEN** slots MAY be returned within the exception hours.

#### Scenario: Holiday provider is unavailable

- **GIVEN** ArgentinaDatos cannot be reached during an import
- **WHEN** public availability is requested
- **THEN** availability MUST continue using the last persisted exceptions
- **AND** the failed import MUST NOT alter existing exceptions.
