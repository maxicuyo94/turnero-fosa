# Turnero Taller Express MVP

This repository contains the Taller de motos Express appointment scheduler MVP: public booking, protected internal agenda, workshop settings, service visibility, and the dark/apple-green UI baseline.

## Shop development — incremental delivery

The shop is being built in [independently verifiable deliveries](openspec/changes/spare-parts-shop/deliverables.md).
E1 (internal inventory and Excel import) was published in production. E2 (scanning,
labels and stock counts) is implemented and was verified in Preview on 2026-09-24.
Customer accounts, counter sales, quotes, storefront, checkout and shipping are later deliveries.

- `/internal/shop`: inventory totals, availability, low-stock alerts and recent products.
- `/internal/shop/inventory`: search/filter and create products with SKU, optional barcode, ARS price, physical location and opening stock.
- `/internal/shop/inventory/[id]`: edit product details, record receipts, physical-count adjustments and repair consumption, and inspect the last 50 movements.

All routes/actions require the existing internal session. Quantities change through audited movements;
product edits do not overwrite stock. Available stock is physical stock minus reserved units.
Optimistic versions protect concurrent edits; repeated operation keys do not create duplicate movements.
The additive migration `20260915150000_shop_inventory` creates independent tables and does not change appointments.
Do not reseed an existing database to apply this delivery; use its migration.

Camera scanning, printable labels and stock-count sessions are available in E2.
The catalog starts empty; add actual products from the panel. The user confirmed on
2026-09-29 that the workshop hardware test was performed; device details and results
were not recorded in this repository.

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
`vitest.setup.ts` refuses to start the suite when `DATABASE_URL` points to a non-local, non-allowlisted
database (the same rule as the test-data loader), because integration tests rewrite settings and delete rows.
The inventory database tests also remove only their own fixtures.

## Audit fixes — pending deployment

Commit `baeaf1c` on branch `fix/audit-findings` (2026-10-02) closes the findings of a code audit.
It is **not yet in `preview` or `main`**, so neither environment runs it.

- **Booking:** public fields are bounded (name 120, phone 40 characters with 6–20 digits, email 254,
  brand/model 60, plate 20) and each client address may submit 10 bookings per hour; signed-in staff are exempt.
  The booking email is stored on the appointment (`Appointment.contactEmail`) instead of overwriting an
  existing customer's email; notifications prefer it. The confirmation email links to `/booking/status`
  and, when online cancellation is on, to the cancellation page.
- **Auth:** login attempts are counted atomically before the password check (5 failures per username and
  20 per IP in 15 minutes); successes and refused attempts are given back. Changing the password bumps
  `User.sessionVersion`, which signs out every session of that account. The login page and home read the
  staff member from the database, so a token whose account was deleted no longer loops between redirects.
- **Settings:** confirmation mode and online cancellation are editable in Configuración; the home chips
  reflect the stored policy. A service duration must be a multiple of the slot step.
- **Payments:** the webhook reads the same Mercado Pago configuration as checkout and answers 503 when it is invalid.
- **Headers:** every route sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` and
  `strict-origin-when-cross-origin` ([next.config.ts](next.config.ts)).
- **Inventory/units:** low-stock labels filter before applying the page limit, Excel prices round to cents,
  and **Interno → Unidades** searches in SQL and returns at most 200 units.

Migrations, applied by `vercel-build` on the next deploy of each environment:

| Migration | Effect |
|---|---|
| `20261002120000_audit_fixes` | Additive: `Appointment.contactEmail`, `User.sessionVersion` (default 0); `cancellationEnabled` defaults to `false`. |
| `20261002130000_drop_unused_columns` | **Destructive:** drops `WorkshopSettings.reschedulingEnabled`, `User.emailVerified`, `User.image` and the Auth.js adapter tables `Account`, `Session`, `VerificationToken`. The app never read them (JWT sessions, no adapter); review before deploying. |

Deploying bumps nothing for existing users (`sessionVersion` starts at 0), so current sessions stay valid.

## Roadmap and known issues

- [Product roadmap](openspec/ROADMAP.md): delivered capabilities, priorities, future changes, and release criteria.
- [Errors and risks backlog](openspec/BACKLOG.md): reproduction evidence, investigation status, and acceptance criteria.

The deposit integration was tested in Preview with an approved Mercado Pago test
purchase on 2026-09-23; the appointment was confirmed. Live collection remains a
separate rollout and is not implied by that test. The historical release evidence
for `e15ebe8` (2026-09-09) does not certify the current deployment.

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
affect new reservations and preserve existing appointment intervals; a duration must be a
multiple of the slot step or the service would have no bookable time.

### Mercado Pago deposits

- **Checkout:** Checkout Pro with `binary_mode` and cash vouchers/ATM excluded, so a
  payment is approved or rejected at once and never settles after the reservation
  (`depositExpirationMinutes`) ends. One external reference per attempt doubles as the
  `X-Idempotency-Key`, and concurrent starts share a single stored checkout link.
- **Settlement:** the signed webhook (`/api/mercado-pago/webhook`) is the primary signal.
  `TEST-` sandbox credentials never send webhooks (a test seller's `APP_USR-` ones do), and one
  can be lost, so the return page and the
  expiry sweep also read the payment from Mercado Pago. Browser data is never trusted:
  every path re-reads the payment and checks reference, amount, currency and live mode.
- **Expiry sweep:** `GET /api/cron/deposits` with `Authorization: Bearer $CRON_SECRET`
  reconciles overdue checkouts, then releases unpaid reservations. If Mercado Pago cannot
  answer, the reservation is kept for the next run. If expiration must run within a
  strict interval without visits, schedule it every 5–10 minutes (Vercel Cron on a
  Pro plan, or an external scheduler); Hobby plans only allow daily crons.
  Scheduling is a lower-priority improvement today. As a backstop, the booking page
  and internal agenda start the sweep **after** responding, so neither waits on
  Mercado Pago. Public availability already treats a lapsed
  hold as free; a booking settles overdue holds before its transaction, so the capacity check
  there sees their final state. Sweeps within one instance share a single run.
- **Refunds** are issued manually in the Mercado Pago panel. The refund webhook clears the
  "Señas cobradas en turnos cancelados" warning in the internal panel.

#### Testing deposits

**Credentials decide the flow.** `MERCADO_PAGO_ENVIRONMENT=test` has two variants:

| Access token | Checkout | Expected `live_mode` |
| --- | --- | --- |
| `TEST-…` (application sandbox credentials) | `sandbox_init_point` | `false` |
| `APP_USR-…` of a **test seller** (Mercado Pago's current approach, used in preview) | `init_point` | `true` |
| `APP_USR-…` of the real account (`production`) | `init_point` | `true` |

Payments between test users arrive with `live_mode: true`. The webhook, return page and
sweep all compare it through `expectedPaymentLiveMode()`. A mismatch marks the attempt
`ERROR` and leaves the appointment unconfirmed.

**Test users.** Both accounts must be test users from the same country (Argentina, `MLA`),
and the buyer must differ from the seller. `GET /users/me` with the token tells whose it is
(the `id` is also the token's last segment). To create another buyer, run
`POST /users/test_user` with `{"site_id":"MLA"}` and the seller's token. Passwords, and the
verification code (the last 6 digits of the user id), live in `PREVIEW.local.md`, never in Git.

| Role | Nickname | Id |
| --- | --- | --- |
| Seller (owns the preview token) | `TESTUSER7552394290258579910` | `3218633687` |
| Buyer | `TESTUSER5269001949493745698` | `3712586690` |

**Cards.** These are [Mercado Pago's public test cards](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test/test-purchases),
with CVV `123` (Amex `1234`), expiry `11/30`, and DNI `12345678`. The cardholder name picks
the result:

| Card | Number |
| --- | --- |
| Mastercard credit | `5031 7557 3453 0604` |
| Visa credit | `4509 9535 6623 3704` |
| Visa debit | `4002 7686 9439 5619` |

| Cardholder | Result |
| --- | --- |
| `APRO` | Approved |
| `OTHE` | Rejected (general error) |
| `CONT` | Pending (not reachable here, because `binary_mode` makes it a rejection) |
| `FUND` / `SECU` / `EXPI` / `CALL` | Rejected: insufficient funds / bad CVV / bad expiry / needs authorization |

**Run.**
1. Book on the branch URL, https://turnero-fosa-git-preview-maxicuyo94s-projects.vercel.app/booking,
   not on a `turnero-fosa-<hash>-…` deployment URL: environment variables are fixed per deployment,
   so an older one may lack the Mercado Pago credentials and say that online payment is off.
   Preview has Vercel Deployment Protection: people log in to Vercel, scripts send the
   `x-vercel-protection-bypass` header.
2. In a Chrome or Edge incognito window (Brave's Shields block the checkout's reCAPTCHA and
   fraud script), log in to Mercado Pago as the **buyer**, open the checkout link and pay.
3. Check the results:
   - `/booking/payment?reference=…` shows the outcome, and `/booking/status?code=…` the appointment.
   - The `DepositPaymentAttempt` is `APPROVED`, with `providerPaymentId` and `lastNotificationAt` set.
   - The appointment is confirmed, and `AppointmentStatusHistory` records the change.
   - `EmailLog` has the confirmation email.
   - `vercel logs` shows `POST /api/mercado-pago/webhook` returning 200. On the Hobby plan Vercel
     keeps runtime logs for one hour only, so check them right after paying.
4. Edge cases:
   - `OTHE` keeps the hold until it expires.
   - An unpaid hold is released after `depositExpirationMinutes` (30 by default). The release
     needs the sweep, which requires `CRON_SECRET`.
   - A refund made from the seller's panel clears the paid-cancellation warning.

**Pitfalls seen while testing.**
- A retried payment reuses the appointment's checkout until it expires, so each new scenario
  needs a new booking.
- "Una de las partes … es de prueba" means a real party is involved: paying as a guest, a real
  Mercado Libre session in the browser, or the seller account used as the buyer.
- If "Pagar" stays disabled with a saved card, choose "Modificar" and enter the card as new.
- Emails from preview come from Resend's `onboarding@resend.dev`, which only delivers to the
  Resend account owner; bookings made with other addresses leave their emails `FAILED`.

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
the database on each request, so a deleted account or a changed role applies immediately. A session
whose `sessionVersion` no longer matches the account (after a password change) is rejected too.

Login and public booking share a PostgreSQL-backed limiter ([src/lib/rate-limit.ts](src/lib/rate-limit.ts),
table `LoginThrottle`), so every serverless instance sees the same counters. The client address is the
first hop of `X-Forwarded-For`.

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

Also delivered: internal rescheduling with interval history, configurable deposits, hosted Mercado Pago checkout, signed payment webhooks, and reservation expiration. A Mercado Pago test purchase approved on Preview confirmed its appointment on 2026-09-23 through the return page and sweep. The signed-notification acceptance is recorded in the payment tasks; observing immediate confirmation by webhook in runtime logs remains a separate check. Live payment activation remains pending in the roadmap.

Published in Preview and Production on 2026-09-29: the appointment drawer can copy the public code,
call or open WhatsApp using the stored phone, and correct customer name, phone,
email and appointment notes. Contact changes affect all appointments of that
customer; notes affect only the selected appointment. Field changes record their
previous and new values, staff member and time. Both environments applied the additive
`20260929120000_appointment_detail_history` migration. PostgreSQL tests and the
desktop/mobile browser flow passed locally; the published public routes returned 200;
see [daily appointment details](openspec/changes/daily-appointment-details/tasks.md).

Intentionally deferred: automatic WhatsApp, contact/social persistence, age capture, advanced reports, full mechanical history, multi-branch support, and public online rescheduling. E1 is published and E2 has been verified in Preview, as described above.

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

The normalized plate has a partial unique index since migration
`20260924150000_unique_vehicle_plate`. The earlier duplicate-merge feature was
removed after the test data was cleared. **Interno → Unidades** searches by plate,
brand, model or customer and shows the unit's appointments and ownership changes.
Staff can correct a plate from the unit record; a plate held by another unit is
rejected and each accepted correction is recorded in `VehiclePlateChange`.
The record also edits type, brand, model, year, chassis and engine number, colour
and notes. Apply existing migrations with `prisma migrate deploy`, not by reseeding.

## Taller Express Defaults

| Field | Value |
|---|---|
| Name | Taller de motos Express |
| Address | B° Parques Nacionales, calle Los Cardones 3289 |
| Instagram | Expresstallerdemotos |
| Booking mode | Turnos programados, automatically confirmed (editable in Configuración) |
| Public cancellation | Disabled by default, editable in Configuración |
| Public rescheduling | Not offered |
| Deposit policy | Configurable amount (initial value ARS 5,000); collection disabled by default, live activation pending |
| Services | Service Esencial 60 min, Service Deluxe 4 h, Reparaciones generales, Reparacion de motor, Enderezado de chasis, Enderezado de barrales |
| Notifications requested | Email and WhatsApp |

Pending before launch: phone/WhatsApp number, exact weekly hours, lunch break or continuous schedule, real concurrent motorcycle capacity, whether prices are public, and exact durations for repair services.

## Public booking verification status

- Repeated idempotent submissions do not expose invalid cancellation links.
- Field bounds, phone digit count and the per-address limit are covered by `tests/public-booking.test.ts`
  and `tests/rate-limit.test.ts` (on `fix/audit-findings`).
- Playwright public booking checks clean up their test data and can run repeatedly.
- PostgreSQL-backed integration tests cover cancellation, idempotency, and concurrent capacity behavior.

## Internal operations verification status

- Internal routes and server actions require an Auth.js-backed workshop session.
- The shared navbar shows the logged-in internal user name/email and exposes `Salir` on internal screens.
- Status updates write `AppointmentStatusHistory` rows with the authenticated user id when available, or `null` for system/internal actions without a user id.
- PostgreSQL-backed integration tests cover status updates and status-history attribution.

## Next implementation slice

Atomic status transitions and strict date/time validation are complete. Mercado Pago
has an approved test purchase in Preview, and payment concurrency and reconciliation
have code and PostgreSQL coverage. The next product work is tracked in the
[roadmap](openspec/ROADMAP.md); the [backlog](openspec/BACKLOG.md) separates remaining
edge-case evidence and live activation from completed testing. Scheduling the deposit
and email cron endpoints is a lower-priority operational improvement for now.

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
- `CRON_SECRET` exists in Production and in Preview (scoped to the `preview` branch), with different values kept in `PRODUCTION.local.md` and `PREVIEW.local.md`. Calls without it get 401. No scheduler calls `/api/cron/deposits` and `/api/cron/emails` yet; this is a lower-priority operational improvement today because request-triggered delivery and reconciliation provide a backstop. Reassess its priority if mandatory deposits or delivery deadlines are introduced.
- Email delivery is disabled when `RESEND_API_KEY` and `EMAIL_FROM` are absent (queued emails then end as `FAILED`). Until the workshop verifies a domain in Resend, the sender is `onboarding@resend.dev`, which only delivers to the Resend account owner.
- Every date and time is computed in the workshop's zone (`America/Argentina/Buenos_Aires`) through [src/lib/workshop-date.ts](src/lib/workshop-date.ts); nothing else hardcodes an offset or zone.
- CI uses an ephemeral PostgreSQL 17 service and deterministic non-production values from `.github/workflows/ci.yml`.

Confirmed production policy values remain capacity `2`, automatic confirmation, two-hour minimum notice, a 30-day booking window, and online cancellation disabled (now editable; rescheduling is internal only).

## Schedules and date exceptions

The internal panel maintains the seven-day opening hours and their breaks as one validated unit, plus
date-specific exceptions. A date exception replaces the weekly row for that single date: an imported
Argentine national holiday closes it, and a manual exception can open a normally closed date within
explicit hours. Breaks, minimum notice, and the booking window still apply on an exceptional opening.

`Importar feriados` fetches `https://api.argentinadatos.com/v1/feriados/{year}` on demand and upserts
the response as closed exceptions. Public booking never calls the provider: availability always reads
the persisted rows. A failed or malformed response leaves every stored exception untouched, and rows a
workshop user edited by hand are preserved across later imports.
