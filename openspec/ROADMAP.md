# Product application roadmap

This roadmap sequences the next product improvements into independently reviewable OpenSpec changes. Each phase must preserve the scheduling invariants and pass the complete quality suite before deployment to `preview` and then `main`.

## Delivery order

### Phase 1 — Safe appointment rescheduling

Outcome: authorized staff can change an appointment's date, start time, and total duration without creating an invalid or over-capacity interval.

- Reuse one scheduling policy for public booking, internal rescheduling, and duration changes.
- Validate service minimum duration, slot-step alignment, opening hours, date exceptions and holidays, breaks, day boundary, terminal status, and capacity for the complete proposed interval.
- Exclude the appointment being edited from overlap counts.
- Revalidate and update inside one database transaction with the same capacity lock used to prevent concurrent overbooking.
- Allow both shortening and extending, but never below the selected service's configured minimum duration.
- Record previous and new intervals, the authenticated operator, timestamp, and optional reason.
- Notify the customer only after a successful commit.

Detailed artifacts live in `openspec/changes/safe-appointment-rescheduling/`.

### Phase 2 — Faster daily operations

Outcome: common workshop actions require fewer clicks.

- Add previous, today, and next navigation to day/week agenda views.
- Add copy-public-code, call, and WhatsApp shortcuts to appointment details.
- Add safe editing for customer contact, motorcycle details, and operational notes.
- Show interval and status history in the appointment detail.
- Replace the mobile seven-column week with a compact list or three-day view while retaining the desktop week grid.
- Show closed holidays as `Taller cerrado` and flag any legacy appointment that overlaps a closed date.

### Phase 3 — Customer communications

Outcome: customers receive timely confirmations and reminders.

- Complete the production Resend sender-domain setup.
- Send rescheduling, duration-change, confirmation, cancellation, and reminder messages from an outbox/worker flow.
- Make reminder lead times configurable.
- Add delivery status and retry visibility to the internal panel.
- Introduce WhatsApp only after provider, consent, template, and cost decisions are recorded.

### Phase 4 — Deposits and payments

Outcome: the workshop can require and reconcile a configurable booking deposit.

- Use **Mercado Pago Checkout Pro** as the payment provider. Customers complete payment in Mercado Pago's hosted checkout; the application MUST NOT collect or store card data.
- Replace the documented fixed ARS 5,000 assumption with configurable policy values.
- Create one backend payment preference for each deposit attempt and correlate it to the appointment through an internal payment ID and Mercado Pago `external_reference`.
- Treat browser return URLs as presentation only. Payment approval MUST be confirmed server-to-server from Mercado Pago data.
- Receive the `payments` Webhook event through HTTPS, validate the `x-signature` secret signature, retrieve the referenced payment, and process every notification idempotently.
- Model pending, approved, rejected, expired, and refunded payment states.
- Define reservation expiry and capacity release behavior for unpaid bookings.
- Keep separate test and production credentials in environment configuration and complete Mercado Pago test purchases before activation.
- Add reconciliation, cancellation, refund, duplicate-notification, and chargeback handling before enabling mandatory deposits.

### Phase 5 — Capacity and reporting

Outcome: staff can understand workload and business performance.

- Add capacity-lane visualization for simultaneous motorcycles.
- Show occupancy gaps and over-capacity legacy records.
- Add weekly appointment, cancellation, no-show, service-demand, utilization, and returning-customer metrics.
- Define metric semantics and timezone boundaries before building charts.

### Phase 6 — Roles and production operations

Outcome: the system is safe to operate with multiple staff members.

- Add least-privilege roles for administrator, reception, and mechanic workflows.
- Add immutable audit events for protected mutations.
- Add error monitoring, health checks, backup-restore drills, rate limits, and security review.
- Extend Playwright coverage to mobile, rescheduling concurrency, payments, and reminder delivery.

## Release gates

Every phase must:

1. Start with accepted proposal, specification, design, and task artifacts.
2. Keep each implementation review below the configured 800-line budget or split it into smaller changes.
3. Use strict RED-GREEN-REFACTOR for behavior changes.
4. Pass `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
5. Deploy to `preview`, complete desktop/mobile acceptance checks, and only then promote the same commit to `main`.
