## 1. Payment domain and persistence

- [x] 1.1 Add deposit policy and payment-attempt schema plus migration.
- [x] 1.2 Add preference initiation, attempt reuse, provider-state mapping, and mismatch rejection.
- [x] 1.3 Reconcile approval and expiration with appointment status history.

## 2. Mercado Pago boundary

- [x] 2.1 Add Checkout Pro preference and payment retrieval adapter.
- [x] 2.2 Validate signed webhook timestamps and HMAC signatures.
- [x] 2.3 Add webhook route and informational return page.

## 3. Booking and operations

- [x] 3.1 Keep deposit-backed bookings pending and show amount/expiration before submit.
- [x] 3.2 Add checkout link and safe retry by public booking code.
- [x] 3.3 Add internal deposit settings.
- [ ] 3.4 Configure test credentials and complete a Mercado Pago test purchase.

## 4. Verification and rollout

- [x] 4.1 Pass typecheck, lint, unit/integration tests, E2E, and build.
- [x] 4.2 Deploy migration and code to Preview with deposit collection disabled by default.
- [ ] 4.3 Configure Preview webhook and complete signed-notification acceptance.
- [ ] 4.4 Configure production credentials, enable the policy, and monitor first live payment.
