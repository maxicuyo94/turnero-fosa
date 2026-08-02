## Decisions

### Provider redirects never confirm a booking

Browser return URLs are informational. A payment is authoritative only after a valid signed webhook causes the server to retrieve the payment from Mercado Pago and verify external reference, amount, currency, and test/production mode.

### Persist before contacting the provider

Each checkout has a unique external reference and local attempt row before preference creation. A still-valid pending attempt is reused, making retries safe and preventing duplicate checkout preferences.

### Appointment transitions follow reconciled payment state

Approved payments confirm pending appointments in the same database transaction as payment reconciliation. Expired or cancelled payment attempts cancel pending reservations and append status history. Rejected payments remain visible and may be retried.

### Signed and idempotent webhook boundary

The webhook validates Mercado Pago's HMAC signature and timestamp, acknowledges unrelated event types, then retrieves payment data by ID. Provider payment IDs and external references are unique; repeated notifications do not create repeated appointment transitions.

### Safe activation

Checkout stays unavailable unless both the access token and webhook secret exist. Deposit policy is independently configurable, allowing migration and code rollout before credentials and test-purchase acceptance are complete.

## Rollback

Disable `depositRequired` first. The payment attempt table and settings columns can remain without affecting bookings. Do not remove persisted payment records during an application rollback.
