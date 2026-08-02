## Why

Online bookings currently reserve capacity without collecting the configured deposit. The workshop needs Mercado Pago Checkout Pro so a reservation is confirmed only from verified provider data, while failures and expired checkouts release capacity safely.

## What Changes

- Add configurable deposit requirement, amount, and checkout expiration.
- Create and persist Mercado Pago Checkout Pro preferences for new public bookings.
- Validate signed payment webhooks, retrieve authoritative payment data, and reconcile local state idempotently.
- Confirm appointments only for a matching approved payment; cancel unpaid expired reservations.
- Add customer return/status and retry experiences plus local operational documentation.

## Capabilities

### Modified Capabilities

- `public-booking`: deposit-backed reservations remain pending until an approved payment.
- `appointment-management`: payment approval and expiration transition appointment status with history.
- `workshop-settings`: staff can configure the deposit policy.

### New Capabilities

- `deposit-payments`: hosted checkout, signed webhook reconciliation, provider-data verification, and payment-attempt persistence.

## MVP Boundaries

- Checkout Pro hosted checkout in ARS only.
- One fixed deposit amount applies to every public service.
- Refund initiation, chargeback operations, installments policy, and financial reporting remain out of scope.
