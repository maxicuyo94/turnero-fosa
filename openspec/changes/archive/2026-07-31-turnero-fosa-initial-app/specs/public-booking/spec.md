# Public Booking Specification

## Purpose

Define customer-facing booking creation and workshop-policy self-service actions.

## ADDED Requirements

### Requirement: Public Appointment Request

The system MUST let public users choose an active service, select an available slot, provide customer and motorcycle data, and create an appointment using the configured confirmation mode.

#### Scenario: Booking is created

- GIVEN an active service and available slot
- WHEN a public user submits valid customer and motorcycle details
- THEN an appointment MUST be created with confirmed status when automatic confirmation is configured
- AND the user receives a booking outcome message.

#### Scenario: Invalid slot submission

- GIVEN a slot is no longer available
- WHEN the public user submits the booking
- THEN no appointment MUST be created
- AND the user MUST be asked to choose another slot.

### Requirement: Public Cancellation

The system MUST allow online cancellation when the workshop policy enables it and the appointment is eligible.

#### Scenario: Cancellation disabled by policy

- GIVEN online cancellation is disabled for Taller Express
- WHEN a public booking is created
- THEN no public cancellation link MUST be exposed
- AND the user MUST NOT be offered online rescheduling.

#### Scenario: Cancellation succeeds

- GIVEN online cancellation is enabled for an eligible appointment
- WHEN the public user confirms cancellation
- THEN the appointment status MUST become cancelled.
