## Purpose

Allow customers to check the current state of an appointment without an account while limiting the information exposed through an anonymous lookup.

## ADDED Requirements

### Requirement: Public Appointment Status Lookup

The system MUST allow an anonymous user to look up an appointment by its public code and MUST normalize letter casing and surrounding whitespace before lookup.

#### Scenario: Existing appointment is found

- **GIVEN** a valid public appointment code
- **WHEN** a user submits the code on the public status page
- **THEN** the system MUST show the public code, service, appointment date, appointment time, and current status.

#### Scenario: Code uses different casing or surrounding whitespace

- **GIVEN** an existing public appointment code entered with different letter casing or surrounding whitespace
- **WHEN** a user submits the code
- **THEN** the system MUST return the matching appointment summary.

#### Scenario: Appointment is not found

- **GIVEN** an unknown or malformed public appointment code
- **WHEN** a user submits the code
- **THEN** the system MUST show a generic not-found message
- **AND** MUST NOT reveal information about any other appointment.

### Requirement: Anonymous Lookup Privacy

The public appointment status response MUST NOT expose customer identity or contact data, motorcycle data, appointment notes, internal identifiers, idempotency keys, cancellation credentials, or status history.

#### Scenario: Public status summary is displayed

- **GIVEN** an appointment matches the submitted public code
- **WHEN** the public status summary is returned
- **THEN** it MUST contain only the public code, service, appointment date and time, and current status.
