# Tasks: Turnero Fosa Initial App

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,800-2,600 |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 schema/domain → PR 3 public booking → PR 4 internal panel → PR 5 notifications/polish |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
800-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold app, tooling, env, visual shell | PR 1 | First autonomous slice; activates tests early |
| 2 | Prisma schema, seed, settings/catalog/availability domain | PR 2 | Includes concurrency-focused tests |
| 3 | Public services, slot lookup, booking, cancellation | PR 3 | Depends on PR 2 |
| 4 | Authenticated internal agenda, details, status/settings/catalog edits | PR 4 | Depends on PR 2/3 |
| 5 | Notification adapter, E2E, docs, verification polish | PR 5 | Final integration slice |

## Phase 1: Foundation and Tooling

- [x] 1.1 Create `package.json`, `pnpm-lock.yaml`, Next.js/TypeScript/Tailwind configs, and scripts for `typecheck`, `lint`, `test`, `test:e2e`.
- [x] 1.2 Create `.env.example` and `src/lib/env.ts` with Zod validation for database, Auth.js, app URL, and email settings.
- [x] 1.3 Create `app/layout.tsx`, public/internal route shells, global dark/apple-green styles, and baseline reachable pages.
- [x] 1.4 Configure Vitest, React Testing Library, Playwright, and smoke tests proving tooling runs.

## Phase 2: Data Model and Domain Core

- [x] 2.1 Create `prisma/schema.prisma` for settings, schedules, services, customers, motorcycles, appointments, status history, users, auth tables, and email logs.
- [x] 2.2 Create `prisma/seed.ts` with editable Taller Express defaults and env-sourced admin bootstrap.
- [x] 2.3 Create `src/lib/db.ts` and module schemas under `src/modules/{settings,catalog,customers,appointments}`.
- [x] 2.4 Implement `src/modules/availability` with tests for hours, breaks, duration, notice/window, capacity, and closed days.
- [x] 2.5 Implement appointment transaction/idempotency checks with tests for final-capacity concurrent booking.

## Phase 3: Public Booking

- [x] 3.1 Create public service and availability routes/actions using active services only and updated settings.
- [x] 3.2 Create booking form/action that validates customer and motorcycle data and creates appointments using the configured confirmation mode.
- [x] 3.3 Create cancellation route/action honoring policy and never exposing online rescheduling.
- [x] 3.4 Test invalid slot, missing contact data, long-service capacity, and successful cancellation scenarios.

## Phase 4: Internal Operations

- [x] 4.1 Configure Auth.js credentials/session in `src/lib/auth.ts` and protect `app/(internal)/**` mutations/routes.
- [x] 4.2 Create internal daily agenda, empty state, appointment detail, and status update actions with transition tests.
- [x] 4.3 Create settings and catalog maintenance screens/actions; verify changes affect availability and inactive services hide publicly.

## Phase 5: Notifications and Verification

- [x] 5.1 Create `src/modules/notifications` `NotificationPort`, Resend adapter, and failure logging that never blocks booking.
- [x] 5.2 Add Playwright coverage for public booking and internal status change.
- [x] 5.3 Update README/setup docs with env, seed, quality commands, and MVP exclusions.
