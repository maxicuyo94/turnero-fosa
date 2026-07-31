## Why

Weekly schedules exist in the database but cannot be maintained from the internal panel, and availability does not account for date-specific closures such as Argentine national holidays. Development also needs repeatable test data without risking production records.

## What Changes

- Add internal maintenance for weekly opening hours and breaks.
- Import Argentine national holidays into PostgreSQL and allow authorized users to override each date as closed or exceptionally open.
- Make availability use persisted date exceptions before weekly schedules.
- Add explicit, idempotent test-data profiles that refuse to run against production.

## Capabilities

### New Capabilities

- `test-data-management`: Safe and repeatable database-backed test-data profiles for local and non-production environments.

### Modified Capabilities

- `workshop-settings`: Authorized users can edit weekly schedules, breaks, and date-specific exceptions.
- `booking-availability`: Persisted holiday/date exceptions participate in slot calculation.

## Impact

This affects the Prisma schema and migration, availability domain, internal repository/actions/UI, seed tooling, and tests. ArgentinaDatos is used only as an import source; public booking does not call it at request time. Existing capacity and booking policies remain unchanged.
