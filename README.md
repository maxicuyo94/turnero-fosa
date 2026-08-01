# Turnero Taller Express MVP

This repository contains the Taller de motos Express appointment scheduler MVP: public booking, protected internal agenda, workshop settings, service visibility, and the dark/apple-green UI baseline.

## Quick path

1. Use Node.js 24 (`24.18.1` is pinned in `.nvmrc`) and pnpm `10.14.0` through Corepack.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to `.env` and replace the placeholder values.
4. Start PostgreSQL with `docker compose up -d postgres`.
5. Sync and seed the database with `pnpm prisma db push && pnpm db:seed`.
6. Run `pnpm dev` and open `http://localhost:3000`.

If `pnpm` is not available but dependencies already exist in `node_modules`, use the local binaries, for example `./node_modules/.bin/next dev --hostname 0.0.0.0 --port 3000`.

## Quality commands

| Command | Purpose |
|---|---|
| `pnpm typecheck` | TypeScript verification. |
| `pnpm lint` | Next.js ESLint rules. |
| `pnpm test` | Vitest unit/component smoke tests. |
| `pnpm test:e2e` | Playwright coverage for baseline routes, public booking, and internal status changes. |
| `pnpm db:generate` | Generate Prisma Client from `prisma/schema.prisma`. |
| `pnpm db:seed` | Seed editable Taller Express defaults and optional env-sourced admin user. |
| `pnpm test-data:load` | Load the idempotent `development` test-data profile into a local or allowlisted non-production database. |

Local binary equivalents used in this workspace:

| Command | Purpose |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | TypeScript verification. |
| `./node_modules/.bin/eslint .` | Next.js ESLint rules. |
| `./node_modules/.bin/vitest run` | Vitest test suite. |
| `./node_modules/.bin/playwright test` | Playwright E2E suite. |
| `set -a && source .env && set +a && ./node_modules/.bin/tsx prisma/seed.ts` | Seed database with `.env` loaded. |
| `./node_modules/.bin/tsx scripts/load-test-data.ts development` | Load the `development` test-data profile. |

## Test data profiles

`pnpm test-data:load` loads the `development` profile: the editable Taller Express defaults, the
env-sourced admin user, and three deterministic customers, motorcycles, and appointments (pending,
confirmed, and completed) on the next Monday. Every record uses a `test-data-` identifier, so the
profile is idempotent — running it repeatedly refreshes the same rows instead of accumulating copies.

The loader refuses to write anything unless two independent markers agree:

| Marker | Rule |
|---|---|
| Environment | `NODE_ENV` and `VERCEL_ENV` must not be `production`. |
| Target | The `DATABASE_URL` host must be local (`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`) or listed in `TEST_DATA_ALLOWED_HOSTS`. |
| Production names | A host or database name containing `prod` is refused even when allowlisted. |

To load the profile into the Neon `non-production` branch, point `DATABASE_URL` at that branch and add
its host to `TEST_DATA_ALLOWED_HOSTS`. Admin credentials always come from `ADMIN_USERNAME`,
`ADMIN_EMAIL`, and `ADMIN_PASSWORD`; no secret is stored in the repository and none is printed.

## Local database

| Setting | Value |
|---|---|
| Service | PostgreSQL 17 Alpine via `compose.yaml` |
| Container | `turnero-fosa-postgres` |
| Database | `turnero_fosa` |
| Local URL | `postgresql://postgres:postgres@localhost:5432/turnero_fosa` |

The local `.env` file is intentionally ignored by git. Use `.env.example` as the shareable template.

## Internal Access

The seed creates an internal admin when `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are present. The email remains an internal Auth.js identifier; interactive login uses the username.

Default local credentials from `.env.example`:

| Field | Value |
|---|---|
| URL | `http://localhost:3000/internal/login` |
| Username | `admin` |
| Password | `admin123456` |

## Current slice boundary

Implemented now: scaffold, shared dark/apple-green UI, typed env validation, test tooling, Prisma schema, safe seed defaults, availability calculation, public service/slot lookup, public booking creation, policy-based cancellation link handling, Resend email notifications with non-blocking failure logs, Auth.js internal login, session-aware navbar, protected internal agenda with date filter, appointment status updates with status history, settings maintenance, service visibility controls, and E2E coverage for the core public/internal workflows.

Intentionally deferred: automatic WhatsApp, deposit/payment handling, contact/social persistence, age capture, advanced reports, full mechanical history, multi-branch support, inventory, and online rescheduling.

## Taller Express Defaults

| Field | Value |
|---|---|
| Name | Taller de motos Express |
| Address | B° Parques Nacionales, calle Los Cardones 3289 |
| Instagram | Expresstallerdemotos |
| Booking mode | Turnos programados, automatically confirmed |
| Public cancellation/rescheduling | Disabled |
| Deposit policy | 5000 ARS deposit required, payment handling pending |
| Services | Service Esencial 60 min, Service Deluxe 4 h, Reparaciones generales, Reparacion de motor, Enderezado de chasis, Enderezado de barrales |
| Notifications requested | Email and WhatsApp |

Pending before launch: phone/WhatsApp number, exact weekly hours, lunch break or continuous schedule, real concurrent motorcycle capacity, whether prices are public, and exact durations for repair services.

## Public booking verification status

- Repeated idempotent submissions do not expose invalid cancellation links.
- Playwright public booking checks clean up their test data and can run repeatedly.
- PostgreSQL-backed integration tests cover cancellation, idempotency, and concurrent capacity behavior.

## Internal operations verification status

- Internal routes and server actions require an Auth.js-backed workshop session.
- The shared navbar shows the logged-in internal user name/email and exposes `Salir` on internal screens.
- Status updates write `AppointmentStatusHistory` rows with the authenticated user id when available, or `null` for system/internal actions without a user id.
- PostgreSQL-backed integration tests cover status updates and status-history attribution.

## Next implementation slice

The initial OpenSpec change is implemented, verified, and archived. The next priorities are production hardening: verify the sender domain in Resend, confirm workshop policy values, configure preview/development environments, and keep the deployment quality suite automated.

## Security maintenance

Dependabot tracks npm and GitHub Actions updates weekly. `pnpm audit --prod` currently reports one transitive `sharp` advisory inherited from Next.js; do not force `sharp` 0.35 until the installed Next.js release supports that range, then update Next.js and rerun the complete quality suite.

## Environment strategy

- Production uses the Vercel production variables and the Neon `main` branch.
- The Vercel `preview` Git branch and Development environment use the isolated Neon `non-production` branch.
- Email delivery is disabled when `RESEND_API_KEY` and `EMAIL_FROM` are absent. Production email delivery remains pending until the workshop has a verified domain configured in Resend.
- CI uses an ephemeral PostgreSQL 17 service and deterministic non-production values from `.github/workflows/ci.yml`.

Confirmed production policy values remain capacity `2`, automatic confirmation, two-hour minimum notice, a 30-day booking window, and online cancellation/rescheduling disabled.

## Schedules and date exceptions

The internal panel maintains the seven-day opening hours and their breaks as one validated unit, plus
date-specific exceptions. A date exception replaces the weekly row for that single date: an imported
Argentine national holiday closes it, and a manual exception can open a normally closed date within
explicit hours. Breaks, minimum notice, and the booking window still apply on an exceptional opening.

`Importar feriados` fetches `https://api.argentinadatos.com/v1/feriados/{year}` on demand and upserts
the response as closed exceptions. Public booking never calls the provider: availability always reads
the persisted rows. A failed or malformed response leaves every stored exception untouched, and rows a
workshop user edited by hand are preserved across later imports.
