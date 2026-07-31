## Context

Recurring `WeeklySchedule` and `ScheduleBreak` rows already drive availability, but internal maintenance currently exposes only capacity and booking-window fields. ArgentinaDatos publishes yearly national holidays, and Neon now has an isolated `non-production` branch.

## Goals / Non-Goals

**Goals:**

- Persist all schedule decisions needed by availability.
- Import holidays ahead of time and permit workshop-specific overrides.
- Make test datasets repeatable and impossible to load accidentally into production.

**Non-Goals:**

- Calling an external holiday API during public booking.
- Modeling provincial or municipal holidays in the first version.
- Adding phone, pricing, deposit collection, or payments.

## Decisions

### Date exceptions are persisted

Add a workshop-owned date exception with date, label/source, open/closed state, and optional opening/closing times. Availability checks it before the weekly schedule. This supports holidays, one-off closures, and exceptional openings with one rule.

### Holiday import is an explicit operation

An authenticated action or maintenance command fetches `https://api.argentinadatos.com/v1/feriados/{year}`, validates the response, and upserts imported closed exceptions. Manual overrides are preserved rather than overwritten by later imports.

### Weekly schedule updates are transactional

The internal panel submits the seven-day schedule and breaks as one validated unit. The repository replaces those workshop-owned rows in a transaction so availability never observes a partial configuration.

### Test profiles use commands plus environment guards

Add a named development profile with deterministic identifiers. The loader requires an explicit profile and an allowed environment/host marker; production identifiers are denied before Prisma writes begin. Credentials remain environment-sourced.

## Risks / Trade-offs

- ArgentinaDatos may change or fail -> validate its payload and retain persisted exceptions on failure.
- Holiday imports can overwrite workshop intent -> distinguish imported rows from manual overrides and preserve manual values.
- Complex schedule forms can submit inconsistent breaks -> validate ordering, containment, and overlaps before the transaction.
- Database host checks alone can be brittle -> require both a non-production environment marker and an allowlisted local/non-production target.

## Migration Plan

1. Add the date-exception model and migration without changing existing weekly rows.
2. Deploy repository/domain support and tests.
3. Add internal schedule, exception, and import controls.
4. Import the current and next Argentine holiday years into non-production, verify availability, then repeat in production.
5. Roll back behavior by ignoring exception rows; retain the table to avoid destructive rollback.
