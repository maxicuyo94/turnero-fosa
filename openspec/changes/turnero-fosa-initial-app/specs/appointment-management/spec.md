# Appointment Management Specification

## Purpose

Define protected workshop operations for daily appointment handling.

## Requirements

### Requirement: Daily Agenda

Authorized users MUST view appointments for a selected day with time, service, customer, motorcycle, notes, and status.

#### Scenario: View today's agenda

- GIVEN an authorized user opens the internal panel
- WHEN the daily agenda loads
- THEN appointments for the selected date MUST be shown in time order.

#### Scenario: Empty day

- GIVEN no appointments exist for the selected date
- WHEN the agenda loads
- THEN an empty state MUST be shown.

### Requirement: Status Lifecycle

Authorized users MUST update appointment status through valid MVP states: pending, confirmed, in_progress, completed, cancelled, and no_show.

#### Scenario: Confirm pending appointment

- GIVEN a pending appointment exists
- WHEN an authorized user confirms it
- THEN its status MUST become confirmed.

#### Scenario: Invalid transition is blocked

- GIVEN a completed appointment exists
- WHEN a user attempts an unsupported transition
- THEN the status MUST remain unchanged
- AND an error MUST explain the invalid transition.
