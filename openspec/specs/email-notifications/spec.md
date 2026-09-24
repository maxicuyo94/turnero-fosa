# email-notifications Specification

## Purpose
Define user-observable email and WhatsApp notification behavior while keeping providers replaceable.
## Requirements
### Requirement: Booking Email Notifications

The system MUST attempt to send email notifications for booking creation and internal status changes when email configuration is available, and MAY support a WhatsApp notification provider when configured.

#### Scenario: Booking notification sent

- GIVEN email is configured and a booking is created
- WHEN the appointment is accepted as pending
- THEN a booking email SHOULD be queued or sent to the customer.

#### Scenario: Email unavailable does not break booking

- GIVEN email configuration is unavailable or provider delivery fails
- WHEN a valid booking is submitted
- THEN the appointment MUST still be created
- AND the failure MUST be visible to operators.

### Requirement: Provider Boundary

Notification behavior MUST be expressed through provider-neutral outcomes, not Resend-specific or WhatsApp-vendor-specific UI behavior.

#### Scenario: Provider can be replaced

- GIVEN notification behavior remains the same
- WHEN the email provider changes
- THEN booking and status workflows MUST keep the same user-visible outcomes.

### Requirement: Email Outbox Delivery

Customer emails MUST be recorded in an outbox by the same database write that creates, confirms or reschedules the appointment, and MUST be delivered after the response, never while the customer waits.

#### Scenario: Email queued with the change

- GIVEN a customer with an email books, or staff change the status or interval of their appointment
- WHEN the change is saved
- THEN a pending email MUST be stored in the same transaction
- AND the change MUST NOT exist without its email, nor the email without the change.

#### Scenario: Delivery retried after a provider failure

- GIVEN a pending email whose delivery fails
- WHEN the outbox is delivered again, after a request or by the email cron
- THEN it MUST be retried with growing delays, up to 5 attempts
- AND then it MUST be marked failed with the reason visible to operators.

#### Scenario: No duplicate or stale email

- GIVEN several dispatchers run at once, or a delivery response is lost
- WHEN they process the outbox
- THEN each email MUST be claimed by one dispatcher and carry an idempotency key per outbox row
- AND an email older than 24 hours MUST be marked failed instead of sent.
