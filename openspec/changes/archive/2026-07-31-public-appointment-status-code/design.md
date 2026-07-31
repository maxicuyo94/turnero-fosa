## Context

See `proposal.md` for motivation. Appointments use an internal CUID and may have a separate hashed cancellation token, but neither is suitable as a memorable lookup reference. Public booking runs through a domain service and Prisma repository, while the Next.js public pages render server-side. The application is already deployed with existing Appointment rows, so the schema change requires a safe backfill.

## Goals / Non-Goals

**Goals:**

- Provide a human-readable code with enough entropy for an anonymous, privacy-limited lookup.
- Keep lookup results independent of internal appointment and cancellation identifiers.
- Preserve idempotent booking behavior and safely migrate existing records.

**Non-Goals:**

- Customer accounts, ownership verification, status history, cancellation by public code, or online rescheduling.
- Changes to internal status transitions or notification delivery providers.
- Changes to working hours, breaks, capacity, minimum notice, booking window, cancellation policy, or confirmation-mode calculation.

## Decisions

### Persist a random ten-character public code

Appointment gains a required, unique `publicCode`. New bookings generate ten uppercase characters from an alphabet that omits visually ambiguous characters. This is short enough to read and enter while providing substantially more entropy than a sequential number. A database unique constraint remains authoritative. Sequential codes were rejected because they reveal booking volume and make enumeration trivial; reusing the CUID was rejected because it is long and exposes an internal identifier.

### Backfill before enforcing the invariant

The migration adds the column as nullable, assigns distinct codes to existing appointments, then applies the required and unique constraints. Application deployment follows the database migration. Rollback first removes the public status route and code display, then drops the unique constraint and column only after the previous application version is active.

### Keep lookup in the booking domain with a narrow result

The booking repository resolves a normalized code, and a dedicated public lookup use case maps the record to only `publicCode`, `serviceName`, `startAt`, `endAt`, and `status`. The public server-rendered page uses a GET query so customers can bookmark the result. No API route or new dependency is needed. The internal panel and authenticated repository remain unchanged.

### Treat the code as an unverified public capability

Lookup requires no authentication because the requested workflow is public. The response excludes customer name, phone, email, motorcycle details, notes, internal IDs, idempotency data, cancellation token, and history. Unknown and malformed codes share a generic response. Ten random non-ambiguous characters reduce guessing risk, but do not prove appointment ownership; sensitive operations continue to require their existing authorization mechanism.

### Preserve scheduling and status behavior

Code generation occurs only after the existing availability checks and inside the existing booking transaction. It does not alter working hours, breaks, capacity accounting, minimum notice, booking window, cancellation policy, configured confirmation mode, or valid status transitions. Status lookup reads the current persisted status and does not mutate the appointment.

## Risks / Trade-offs

- **A code can be shared or guessed** -> Use high-entropy random codes and expose only a minimal, non-personal summary; deployment-level rate limiting can be added separately if traffic warrants it.
- **A generated code can collide** -> Enforce uniqueness in PostgreSQL and retry code generation when the unique constraint reports a collision.
- **Migration can fail on existing data** -> Backfill every row and verify null and duplicate counts before enforcing constraints.
- **GET lookup places the code in browser history and logs** -> Treat the code as a low-privilege reference that cannot authorize cancellation or expose personal data.

## Migration Plan

1. Apply the additive/backfill migration and generate the Prisma client.
2. Deploy booking creation, lookup behavior, confirmation display, and tests together.
3. Verify a new booking returns a code and both new and backfilled codes resolve to privacy-limited summaries.
4. To roll back, deploy the previous UI and service first, then remove the database field in a later migration.
