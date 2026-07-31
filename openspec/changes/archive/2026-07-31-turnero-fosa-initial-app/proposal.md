# Proposal: Turnero Fosa Initial App

## Intent

Build the MVP foundation for a configurable motorcycle-workshop appointment scheduler: a public booking portal plus a protected internal panel for daily operations. The project currently has SDD artifacts only; this change defines the first application build without expanding into future roadmap items.

## Scope

### In Scope
- Scaffold a Next.js/TypeScript app with Tailwind, Prisma/PostgreSQL, Auth.js, Zod, tests, linting/formatting, and deployment-ready configuration.
- Model configurable workshop settings, service catalog, customers, motorcycles, appointments, status lifecycle, and availability rules.
- Public booking flow: select service, view valid slots, enter customer/motorcycle data, create automatically-confirmed appointments, and block public cancellation/reprogramming when policy disables it.
- Protected internal panel: login, daily appointment view, appointment details, status changes, and basic settings/catalog management.
- Email and WhatsApp notification adapters for booking/status messages using provider-compatible boundaries.
- Dark/charcoal visual system with medium fluorescent apple-green accent.

### Out of Scope
- Full online payments, advanced reports, full mechanical history, multi-branch support, inventory, and online rescheduling.
- Native mobile apps, third-party integrations beyond email, or separate API service architecture.

## Capabilities

### New Capabilities
- `app-foundation`: application scaffold, tooling, environment, and deployment baseline.
- `workshop-settings`: configurable identity, schedule, capacity, booking notice/window, policies, and defaults.
- `service-catalog`: bookable services, durations, ordering, and visibility.
- `booking-availability`: valid slot calculation from settings, services, capacity, notice/window, and appointments.
- `public-booking`: customer-facing booking and cancellation workflow.
- `appointment-management`: appointment lifecycle, statuses, daily agenda, details, and internal updates.
- `customer-motorcycle-records`: customer contact data and motorcycle profile capture/reuse.
- `internal-auth`: protected workshop access and public/internal boundary enforcement.
- `email-notifications`: provider-adapted email notifications for booking operations.

### Modified Capabilities
- None; no existing specs are present.

## Approach

Use a modular monolith in Next.js. Keep scheduling logic in tested domain services, not page/server-action glue. Store Taller Express hours, capacity, services, and policies as seed/configurable data, never product constants.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/`, `src/` | New | Next.js routes, UI, domain modules, auth boundaries |
| `prisma/` | New | PostgreSQL schema, migrations, seed/test defaults |
| `tests/` | New | Unit/integration/e2e coverage once scaffold exists |
| `openspec/changes/turnero-fosa-initial-app/` | Modified | Proposal, later specs/design/tasks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Availability bugs or overbooking | High | Isolate and test domain service; use DB transactions/constraints |
| Hardcoded workshop defaults | Med | Treat defaults as seed/config records |
| Public/internal leakage | Med | Define auth and route boundaries early |
| Review size exceeds 800 lines | High | Forecast chained implementation slices in tasks |

## Rollback Plan

Before production data exists, remove the scaffold and generated database artifacts, then revert specs/tasks for this change. After migrations exist, rollback must include Prisma down/replacement migration notes and seeded data reset steps.

## Dependencies

- Node/package manager selection during design/tasks.
- PostgreSQL provider decision: Neon, Supabase, Railway, or local-compatible equivalent.
- Email sender credentials for Resend-compatible adapter.

## Success Criteria

- [ ] MVP behaviors are specified before implementation.
- [ ] Settings/services are configurable and seeded with Taller Express test defaults.
- [ ] Booking availability prevents invalid slots and capacity overbooking.
- [ ] Internal operations are protected and support daily status management.
- [ ] Tests and verification commands are available after scaffold creation.
