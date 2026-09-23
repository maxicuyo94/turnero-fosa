# Turnero Taller Express MVP

This repository contains the Taller de motos Express appointment scheduler MVP: public booking, protected internal agenda, workshop settings, service visibility, and the dark/apple-green UI baseline.

## Shop development — incremental delivery

The shop is being built in [independently verifiable deliveries](openspec/changes/spare-parts-shop/deliverables.md).
Current scope is **E1: internal inventory**, verified in local DEV. The authorized deployment target is Vercel Preview on the `preview` branch; production publication is outside this delivery.

- `/internal/shop`: inventory totals, availability, low-stock alerts and recent products.
- `/internal/shop/inventory`: search/filter and create products with SKU, optional barcode, ARS price, physical location and opening stock.
- `/internal/shop/inventory/[id]`: edit product details, record receipts, physical-count adjustments and repair consumption, and inspect the last 50 movements.

All routes/actions require the existing internal session. Quantities change through audited movements;
product edits do not overwrite stock. Available stock is physical stock minus reserved units.
Optimistic versions protect concurrent edits; repeated operation keys do not create duplicate movements.
The additive migration `20260915150000_shop_inventory` creates independent tables and does not change appointments.
Do not reseed an existing database to apply this delivery; use its migration.

The first delivery accepts barcode text and a manual physical-count adjustment. Camera scanning, count sessions,
labels, customer accounts, point of sale, quotes, storefront, checkout and shipping belong to later deliveries.
The catalog starts empty; add actual products from the panel. Production publication is outside the current authorization.

### Import inventory from Excel

In **Interno → Inventario → Importar desde Excel**, download the template, fill the
`Carga` sheet starting at row 5 (replace or delete the example row), select the `.xlsx` and click **Importar productos**.
The `Ayuda` sheet explains each column. Limits: 3 MB and 1,000 products per file.
Keep SKU and barcode cells as text to preserve leading zeros; prices are in ARS,
with at most two decimal places. Stock quantities are whole numbers, including zero.
SKU is optional when creating a product manually or importing it. Keep the Excel
SKU column, but leave its cells blank to generate codes automatically. Unchanged
rows receive the same generated code even if reordered, so reuploading them is
rejected. Changing a blank-SKU row's content generates a different code; use the
existing product's detail page for corrections or stock receipts.

Imports create new products only. A repeated SKU/barcode within the file or already
in inventory rejects the entire batch. Invalid rows are reported by their Excel row
number (up to 25 details). No product or initial movement is saved unless the whole
batch succeeds. Reuploading a successful file cannot add stock a second time.
Each initial movement records the authenticated staff member and Excel origin.

On Windows, if Vitest's default fork workers time out during startup, run `pnpm exec vitest run --pool=threads --maxWorkers=1`.
The inventory database tests guard against production/non-allowlisted targets and remove only their own fixtures.

## Roadmap and known issues

- [Product roadmap](openspec/ROADMAP.md): delivered capabilities, priorities, future changes, and release criteria. Updated 2026-09-11.
- [Errors and risks backlog](openspec/BACKLOG.md): reproduction evidence, investigation status, and acceptance criteria.

The latest verified production release recorded here is `e15ebe8` (2026-09-09).
Internal rescheduling and the deposit integration code are delivered; enabling
live Mercado Pago collection remains a separate pending rollout.

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
| `pnpm db:migrate` | Apply pending migrations (`prisma migrate deploy`); `pnpm build` no longer does it. |
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

### Business configuration

Internal → Configuración stores operating hours, breaks, capacity, booking windows,
service durations, public phone/WhatsApp, public HTTPS origin, email sender, deposit
amount/expiry, refund terms and activation date in PostgreSQL. Empty origin/sender
fields fall back to deployment environment values. A configured domain must already
point to the app, and the email sender must be verified by the email provider.
Provider API credentials remain in environment variables.

Deposit activation starts at midnight Argentina on the selected date, only while
the deposit toggle is enabled. Empty activation dates preserve immediate activation.
Refund terms are displayed publicly; refunds are processed manually. Duration edits
affect new reservations and preserve existing appointment intervals.

### Mercado Pago deposits

- **Checkout:** Checkout Pro with `binary_mode` and cash vouchers/ATM excluded, so a
  payment is approved or rejected at once and never settles after the reservation
  (`depositExpirationMinutes`) ends. One external reference per attempt doubles as the
  `X-Idempotency-Key`, and concurrent starts share a single stored checkout link.
- **Settlement:** the signed webhook (`/api/mercado-pago/webhook`) is the primary signal.
  Test credentials never send webhooks, and one can be lost, so the return page and the
  expiry sweep also read the payment from Mercado Pago. Browser data is never trusted:
  every path re-reads the payment and checks reference, amount, currency and live mode.
- **Expiry sweep:** `GET /api/cron/deposits` with `Authorization: Bearer $CRON_SECRET`
  reconciles overdue checkouts, then releases unpaid reservations. If Mercado Pago cannot
  answer, the reservation is kept for the next run. Schedule it every 5–10 minutes
  (Vercel Cron on a Pro plan, or an external scheduler); Hobby plans only allow daily
  crons. As a backstop, the booking page and the internal agenda start the sweep **after**
  responding, so neither waits on Mercado Pago. Public availability already treats a lapsed
  hold as free; a booking settles overdue holds before its transaction, so the capacity check
  there sees their final state. Sweeps within one instance share a single run.
- **Refunds** are issued manually in the Mercado Pago panel. The refund webhook clears the
  "Señas cobradas en turnos cancelados" warning in the internal panel.

Lowering capacity preserves existing appointments. Both internal sections display
a persistent warning with links to every future interval above capacity, including
dates outside the selected week. The warning is recalculated from the database on
each page load and disappears once those conflicts are resolved.

Apply `prisma migrate deploy` for existing databases; do not reseed to apply changes,
since the seed resets the operational defaults. Migration columns are nullable and
do not enable deposits or invent contact details.

The seed creates an internal admin when `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are present. The email remains an internal Auth.js identifier; interactive login uses the username.

### Access and roles

`proxy.ts` refuses every `/internal` request without a session. Pages and server actions then call
`requireStaff()` ([src/lib/staff-access.ts](src/lib/staff-access.ts)), which reads the account from
the database on each request, so a deleted account or a changed role applies immediately.

| Role | Can |
|---|---|
| `STAFF` | Agenda (status changes, rescheduling), vehicles, inventory, own account. |
| `ADMIN` | Everything above, plus Configuración: settings, services, vehicle types, hours, special dates and holiday import. |

New accounts start as `STAFF`. The migration `20260923120000_staff_role` made every existing account
`ADMIN`, and the seed keeps the env-sourced admin as `ADMIN`.

### Email outbox

Customer emails are queued in `EmailLog` as `PENDING` by the same database write that creates,
confirms or reschedules the appointment, so an email is never lost to a crash between the two. The
request that queued it delivers it right after responding; `GET /api/cron/emails` (same
`CRON_SECRET` bearer) retries what is left. Each email is tried up to 5 times with backoff, never
sent more than 24 hours late, and carries its outbox id as the Resend `Idempotency-Key`. Concurrent
dispatchers never claim the same row. Without Resend credentials, queued emails end as `FAILED`
with the reason instead of going out days later.

Default local credentials from `.env.example`:

| Field | Value |
|---|---|
| URL | `http://localhost:3000/internal/login` |
| Username | `admin` |
| Password | `admin123456` |

## Current slice boundary

Implemented now: scaffold, shared dark/apple-green UI, typed env validation, test tooling, Prisma schema, safe seed defaults, availability calculation, public service/slot lookup, public booking creation, policy-based cancellation link handling, Resend email notifications through a retrying outbox, Auth.js internal login, session-aware navbar, protected internal agenda with date filter, appointment status updates with status history, settings maintenance, service visibility controls, and E2E coverage for the core public/internal workflows.

Units are now generic vehicles with a configurable type catalog, and a booking reuses the customer
and the unit already on record instead of creating a new pair every time. See
[Vehicles and unit history](#vehicles-and-unit-history).

Also delivered: internal rescheduling with interval history, configurable deposits, hosted Mercado Pago checkout, signed payment webhooks, and reservation expiration. Live payment activation and end-to-end sandbox purchase acceptance remain pending in the roadmap.

Intentionally deferred: automatic WhatsApp, contact/social persistence, age capture, advanced reports, full mechanical history, multi-branch support, and public online rescheduling. Internal inventory is now in local DEV as described above.

## Vehicles and unit history

Appointments reference a `Vehicle`, not a motorcycle. Its type comes from a catalog managed in
**Interno → Configuración → Tipos de vehículo**; the seed creates only `Moto`, and anything else is
added from the panel without a deployment. A type referenced by a vehicle is deactivated, never
deleted, and at least one type stays active because public booking needs one to offer.

A unit is recognised by its normalized license plate — uppercase alphanumerics — so `ab 123 cd`,
`AB-123-CD` and `AB123CD` are the same vehicle and accumulate one history. A customer is recognised
by the digits of their phone. Both are resolved inside the booking transaction, and the record of a
reused customer or vehicle is never overwritten by the booking: only empty fields are filled. When
someone books with a plate registered to another customer, the unit moves to them and the change is
stored in `VehicleOwnerHistory`.

Chassis number, engine number, colour and vehicle notes are internal: public booking never asks for
them. The only field it adds is the vehicle type, and the selector stays hidden while a single type
is configured.

The plate has no unique index yet. Every booking made before this change created its own customer
and vehicle, so production still holds duplicates and a unique constraint would fail the migration.
Until they are merged, a vehicle created for a plate takes an id derived from that plate, which turns
two simultaneous bookings into a primary key collision the booking transaction retries, instead of a
silent duplicate. Duplicates are merged by hand from the panel, never automatically.

**Interno → Unidades** searches by plate, brand, model or customer, and reports every plate loaded on
more than one unit. A unit's record shows its appointments newest first, its ownership changes and the
merges it absorbed, and the appointment detail in the agenda links to it. The record edits type, brand,
model, year, chassis and engine number, colour and notes; the plate is shown disabled.

A merge moves every appointment of the duplicate onto the surviving unit, fills only the fields the
survivor is missing, records the operation in `VehicleMerge` and deletes the source — one transaction,
and a resubmitted form is a no-op because the request key is unique. It cannot be undone from the
panel, so it always takes an explicit confirmation.

Apply the `20260921120000_generic_vehicle` and `20260921160000_vehicle_merge` migrations to existing databases; it renames the table and
backfills, so no appointment loses its unit. Reverting needs the inverse migration: the previous code
queries `Motorcycle` and would fail against the renamed table.

## Taller Express Defaults

| Field | Value |
|---|---|
| Name | Taller de motos Express |
| Address | B° Parques Nacionales, calle Los Cardones 3289 |
| Instagram | Expresstallerdemotos |
| Booking mode | Turnos programados, automatically confirmed |
| Public cancellation/rescheduling | Disabled |
| Deposit policy | Configurable amount (initial value ARS 5,000); collection disabled by default, live activation pending |
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

The proposed next slice is atomic status transitions and strict date/time validation, followed by payment concurrency and reconciliation before live collection. See the [roadmap](openspec/ROADMAP.md) for the delivery order and the [backlog](openspec/BACKLOG.md) for evidence and closure criteria.

## Security maintenance

Dependabot tracks npm and GitHub Actions updates weekly. An earlier audit recorded a transitive `sharp` advisory inherited from Next.js. Run a fresh `pnpm audit --prod` before using that historical result to plan an update, and verify compatibility and the quality suite for the chosen versions.

## Environment strategy

- Production uses the Vercel production variables and the Neon `main` branch.
- The Vercel `preview` Git branch and Development environment use the isolated Neon `non-production` branch.
- Vercel deploys run `pnpm vercel-build` (set in [vercel.json](vercel.json)): `prisma migrate deploy`, the preview admin sync, then `next build`, so each Vercel environment applies pending migrations using its own `DATABASE_URL`. A plain `pnpm build` (local, CI) only builds; migrate explicitly with `pnpm db:migrate`. Keep migrations additive: a deploy whose build fails after migrating leaves the database one step ahead of the running code.
- Preview builds also synchronize the branch-specific admin credentials after migrations; keep the local copy in the Git-ignored `.env.preview.local` file.
- `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` are scoped in Vercel to the `preview` Git
  branch, so **preview verification happens by pushing to `preview`**, not from a feature branch. A
  Vercel variable filtered to one branch is delivered only to that branch, and
  `sync-preview-admin.ts` throws when any of the three is missing. It runs inside `vercel-build`, so the
  deployment dies before `next build` — while `DATABASE_URL`, which carries no filter, resolves fine
  and the migrations apply, which makes the failure read like a build problem when it is not. A
  feature branch gets a working preview only if its own copies are added, or the filter is dropped.
- The `MERCADO_PAGO_*` variables exist only for Preview, scoped to the `preview` Git branch (sandbox credentials). Production has none, so live collection stays off until they are added there.
- `CRON_SECRET` is not configured in any environment yet, so `/api/cron/deposits` and `/api/cron/emails` answer 503 until it is added and a scheduler calls them.
- Email delivery is disabled when `RESEND_API_KEY` and `EMAIL_FROM` are absent (queued emails then end as `FAILED`). Production email delivery remains pending until the workshop has a verified domain configured in Resend.
- Every date and time is computed in the workshop's zone (`America/Argentina/Buenos_Aires`) through [src/lib/workshop-date.ts](src/lib/workshop-date.ts); nothing else hardcodes an offset or zone.
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
