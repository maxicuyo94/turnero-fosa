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

