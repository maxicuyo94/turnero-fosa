# Design: Turnero Fosa Initial App

## Technical Approach

Build a modular Next.js monolith: App Router for public/internal screens, server actions/route handlers for mutations, Prisma/PostgreSQL for persistence, Auth.js for internal access, Zod at every input boundary, and Tailwind for the dark/apple-green UI. Domain logic lives under `src/modules/*`, with availability and appointment invariants tested independently from UI glue. No product defaults are constants; Taller Express values are seeded configurable records.

## Architecture Decisions

| Area | Choice | Alternatives considered | Rationale |
|------|--------|-------------------------|-----------|
| App shape | Single Next.js modular monolith | Separate API/frontend | Faster MVP, lower deployment cost, still keeps upgrade path through explicit modules. |
| Package manager | `pnpm` | npm/yarn | Fast, deterministic, common for Next.js workspaces; tasks should pin via `packageManager`. |
| Boundaries | `src/modules/{settings,catalog,availability,customers,appointments,auth,notifications}` | Feature logic inside routes | Prevents scheduling rules from leaking into pages/server actions. |
| Booking writes | Prisma transaction + DB-backed slot locks/unique idempotency | App-only capacity checks | Capacity must survive concurrent users. Database is the final authority. |
| Auth | Auth.js credentials/admin session for internal routes only | Public auth, custom JWT | MVP needs protected staff access, not customer accounts. Auth.js reduces bespoke security. |
| Notifications | Resend adapter behind `NotificationPort` | Direct Resend calls in actions | Keeps provider replaceable and testable. |

## Domain Modules

- `settings`: workshop profile, weekly hours, breaks, capacity, booking notice/window, cancellation policy, confirmation mode.
- `catalog`: active services, duration, description, order, visibility.
- `availability`: pure slot generation and capacity filtering.
- `customers`: customer contact identity and motorcycle ownership.
- `appointments`: status lifecycle: `PENDING_CONFIRMATION`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- `internal`: daily agenda, appointment detail, status changes, settings/catalog maintenance.
- `notifications`: email events for booking created/cancelled/status changed.

## Data Flow

```text
Public route -> Zod input -> booking action -> availability service
             -> Prisma transaction -> appointment row -> notification port

Internal route -> Auth.js guard -> module action -> Prisma -> daily/status UI
```

## Database Model Outline

Core Prisma models: `WorkshopSettings`, `WeeklySchedule`, `ScheduleBreak`, `Service`, `Customer`, `Motorcycle`, `Appointment`, `AppointmentStatusHistory`, `User`, Auth.js adapter tables, and optional `EmailLog`. `Appointment` stores `startAt`, `endAt`, `status`, `serviceId`, `customerId`, `motorcycleId`, `cancellationTokenHash`, timestamps, and notes. Index appointments by `(startAt,endAt,status)` and daily queries. Exclude `CANCELLED` from capacity counts in code and transaction checks.

## Availability Algorithm

1. Load settings, service duration, weekly schedule, breaks, active appointments, and now.
2. Reject dates outside `minimumNoticeMinutes` and `maximumBookingWindowDays`.
3. Generate candidate start times inside working intervals minus breaks using a configured slot step, initially 30 minutes.
4. For each candidate, compute `[start,end)` and discard if service exceeds open interval or overlaps a break.
5. Count overlapping non-cancelled appointments where `existing.startAt < end && existing.endAt > start`; expose slots whose count is below configured capacity.
6. On create, repeat checks inside the transaction before insert.

## Transaction / Concurrency Approach

Appointment creation runs in a Prisma transaction at the strongest practical isolation supported by the provider. It re-reads overlapping appointments with row-level locking where available, verifies capacity, then inserts. Add an idempotency key for repeated form submissions. If PostgreSQL exclusion constraints are needed later, keep them behind a migration decision because capacity >1 cannot be expressed by a simple unique slot constraint.

## Configuration and Seeding

Use `.env.example` for `DATABASE_URL`, Auth.js secret, Resend key, sender, app URL. `prisma/seed.ts` creates one workshop record with Taller Express defaults: automatic confirmation, cancellation disabled, rescheduling disabled, 2-hour notice, 30-day window, starter services, and one internal admin account sourced from env. Exact weekly hours, lunch policy, phone/WhatsApp, real capacity, prices, and deposit collection remain configuration/model follow-ups before launch.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml` | Create | Next.js, Prisma, Auth.js, test/lint scripts. |
| `app/(public)/*`, `app/(internal)/*` | Create | Public booking and protected panel routes. |
| `src/modules/**` | Create | Domain services, actions, schemas, ports. |
| `src/lib/{db,auth,env}.ts` | Create | Prisma, Auth.js, env validation. |
| `prisma/schema.prisma`, `prisma/seed.ts` | Create | Database schema and configurable defaults. |
| `tests/**` | Create | Unit, integration, and e2e coverage. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | Availability edge cases, status transitions, Zod schemas | Vitest pure service tests. |
| Integration | Booking transaction, cancellation token, internal updates | Vitest + test PostgreSQL/Prisma. |
| E2E | Public booking path and internal daily status change | Playwright after scaffold. |

## Migration / Rollout

No production migration exists yet. Implement in phases: foundation, schema/seed/domain tests, public booking, internal panel, notifications/polish. Tasks should forecast chained PR slices because this exceeds the 800-line review budget.

## Open Questions

- [ ] Confirm PostgreSQL provider before final migration/locking details.
- [ ] Confirm initial service catalog and default admin bootstrap credentials source.
