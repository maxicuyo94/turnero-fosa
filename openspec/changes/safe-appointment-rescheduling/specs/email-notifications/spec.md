## Purpose

Notify customers after a protected appointment interval change succeeds.

## ADDED Requirements

### Requirement: Appointment Interval Change Notification

When an appointment date, start time, or duration changes successfully and the customer has an email address, the system MUST attempt to send the updated interval after the database transaction commits and MUST log the delivery outcome.

#### Scenario: Successful reschedule sends updated interval

- **GIVEN** an appointment with a customer email address
- **WHEN** an authorized user successfully changes its interval
- **THEN** the notification MUST identify the appointment and contain its new date, start time, and end time.

#### Scenario: Rejected reschedule sends nothing

- **GIVEN** a proposed interval is rejected
- **WHEN** the operation returns an error
- **THEN** no interval-change notification MUST be sent or logged as sent.

