## Purpose

Reuse scheduling invariants to protect capacity during internal appointment edits.

## ADDED Requirements

### Requirement: Internal Interval Availability Validation

Before changing an appointment date, start time, or duration, the system MUST validate the complete proposed interval against service minimum duration, slot-step alignment, local day boundary, weekly or exceptional opening hours, breaks, capacity, and capacity-consuming appointment statuses.

#### Scenario: Edited appointment does not conflict with itself

- **GIVEN** an appointment occupies the final configured capacity for its current interval
- **WHEN** an authorized user submits the same interval or another valid interval
- **THEN** capacity calculation MUST exclude that appointment's existing interval.

#### Scenario: Longer duration has no room

- **GIVEN** an eligible appointment followed by another capacity-consuming appointment
- **WHEN** an authorized user requests a duration whose resulting interval overlaps exhausted capacity
- **THEN** the duration change MUST be rejected
- **AND** the existing appointment interval MUST remain unchanged.

#### Scenario: Target interval crosses a break or closure

- **GIVEN** a proposed interval intersects a configured break or a closed date exception
- **WHEN** an authorized user submits the reschedule
- **THEN** the interval change MUST be rejected.

#### Scenario: Concurrent edits compete for final capacity

- **GIVEN** two appointment edits target the final available capacity for overlapping intervals
- **WHEN** both updates are submitted concurrently
- **THEN** at most one update MUST commit.

