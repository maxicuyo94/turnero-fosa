# booking-availability Specification

## Purpose
Define valid slot calculation for public booking and internal planning.
## Requirements
### Requirement: Valid Slot Calculation

The system MUST calculate available slots from working hours, closed days, effective appointment duration, capacity, existing appointments, minimum notice, and maximum booking window. The effective duration MUST default to the service duration, MUST NOT be shorter than it, and MUST align to the configured slot step.

#### Scenario: Slot inside configured hours is available

- **GIVEN** capacity remains for the full selected service duration
- **WHEN** a user requests availability within working hours and policy limits
- **THEN** the slot MAY be returned as available.

#### Scenario: Closed or out-of-policy slot is rejected

- **GIVEN** a requested time is on Sunday, outside working hours, less than 2 hours away, or more than 30 days away
- **WHEN** availability is calculated
- **THEN** the slot MUST NOT be returned.

#### Scenario: Extended interval is available

- **GIVEN** a service defaults to 60 minutes and the user requests 90 minutes
- **WHEN** capacity and configured hours remain available for the complete 90-minute interval
- **THEN** the slot MAY be returned as available with an end time 90 minutes after its start.

#### Scenario: Only the default interval fits

- **GIVEN** a 60-minute service has a start time where 60 minutes fit but 90 minutes cross a break, closing time, or exhausted capacity
- **WHEN** the user requests 90 minutes
- **THEN** that start time MUST NOT be returned as available.

#### Scenario: Duration is not aligned to the slot step

- **GIVEN** the workshop slot step is 30 minutes
- **WHEN** a public user requests 75 minutes
- **THEN** availability MUST reject the duration.

### Requirement: Capacity Protection

The system MUST prevent more simultaneous motorcycles than configured capacity for overlapping appointment intervals.

#### Scenario: Capacity is exhausted

- GIVEN two overlapping appointments occupy capacity 2
- WHEN another user requests an overlapping slot
- THEN that slot MUST be unavailable.

#### Scenario: Concurrent booking conflict

- GIVEN two users attempt to reserve the final capacity for the same interval
- WHEN both submissions are processed
- THEN at most one appointment MUST be accepted.

