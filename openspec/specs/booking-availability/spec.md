# booking-availability Specification

## Purpose
Define valid slot calculation for public booking and internal planning.
## Requirements
### Requirement: Valid Slot Calculation

The system MUST calculate available slots from working hours, closed days, service duration, capacity, existing appointments, minimum notice, and maximum booking window.

#### Scenario: Slot inside configured hours is available

- GIVEN capacity remains for the full selected service duration
- WHEN a user requests availability within working hours and policy limits
- THEN the slot MAY be returned as available.

#### Scenario: Closed or out-of-policy slot is rejected

- GIVEN a requested time is on Sunday, outside working hours, less than 2 hours away, or more than 30 days away
- WHEN availability is calculated
- THEN the slot MUST NOT be returned.

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

