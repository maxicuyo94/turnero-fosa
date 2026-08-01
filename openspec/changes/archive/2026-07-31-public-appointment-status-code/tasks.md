## 1. Appointment Code Persistence

- [x] 1.1 Add failing domain and Prisma integration tests for code format, uniqueness, persistence, and idempotent reuse.
- [x] 1.2 Add the required unique Appointment public-code field and a migration that safely backfills existing rows before enforcing constraints.
- [x] 1.3 Generate readable random codes and persist them through the existing booking transaction with unique-collision retry behavior.

## 2. Public Status Lookup

- [x] 2.1 Add failing tests for normalized successful lookup, generic unknown-code handling, and the privacy-limited response shape.
- [x] 2.2 Implement the repository lookup and public booking-domain use case without exposing internal or customer fields.
- [x] 2.3 Add the public status page with code entry, result details, responsive styling, and a generic not-found state.

## 3. Booking Confirmation

- [x] 3.1 Add failing component and end-to-end coverage for displaying and using the code after booking.
- [x] 3.2 Show the public code and status-page link after successful booking, preserving the existing cancellation-link behavior.
- [x] 3.3 Include the public code in booking confirmation email content.

## 4. Verification

- [x] 4.1 Run strict OpenSpec validation, Prisma generation, lint, type checking, Vitest, Playwright, and the production build.
- [x] 4.2 Confirm the implementation diff remains below the 800-line review budget or split the work before delivery.
