## Why

Customers currently receive a booking outcome but have no simple reference they can retain or use to check whether the workshop confirmed, started, completed, cancelled, or marked the appointment as unattended. A short public code makes that follow-up self-service without requiring an account or exposing the internal appointment identifier.

## What Changes

- Generate and persist a short, unique public code when each appointment is created.
- Show the code prominently after a successful public booking and include it in the confirmation email.
- Add a public status page where a customer can enter the code and see a privacy-limited appointment summary and its current status.
- Keep cancellation tokens, online rescheduling, authentication, scheduling rules, and internal status transitions unchanged.

## Capabilities

### New Capabilities

- `public-appointment-status`: Anonymous, code-based lookup of a privacy-limited appointment status summary.

### Modified Capabilities

- `public-booking`: Successful bookings provide customers with a short public appointment code.

## Impact

This affects the Appointment data model and migration, public booking service and repository contracts, booking confirmation UI and email content, a new public status route, and automated tests. Existing records will be backfilled before the code becomes required and unique; rollback requires removing the lookup UI before dropping the database column. No authentication boundary, scheduling invariant, workshop setting, or status transition changes.
