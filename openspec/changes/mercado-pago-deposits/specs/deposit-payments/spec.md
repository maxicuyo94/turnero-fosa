## Purpose

Collect and reconcile public-booking deposits through Mercado Pago without trusting client-controlled payment state.

## ADDED Requirements

### Requirement: Hosted deposit checkout

When deposits are required, the system MUST create a persisted payment attempt and hosted Checkout Pro preference for the configured ARS amount. It MUST reuse a valid pending attempt for repeated initiation of the same appointment.

#### Scenario: Preference creation succeeds

- **GIVEN** a pending appointment and enabled deposit policy
- **WHEN** checkout is initiated
- **THEN** the customer MUST receive the hosted checkout URL
- **AND** the attempt MUST retain a unique external reference and expiration.

### Requirement: Authoritative payment reconciliation

The system MUST validate the webhook signature and retrieve payment data from Mercado Pago. It MUST reject a payment whose external reference, amount, currency, or environment does not match the local attempt.

#### Scenario: Matching payment is approved

- **GIVEN** a valid signed payment notification
- **WHEN** Mercado Pago reports an approved matching payment
- **THEN** the payment attempt and pending appointment MUST be updated atomically
- **AND** duplicate notifications MUST NOT create duplicate appointment transitions.

#### Scenario: Browser returns before webhook

- **GIVEN** a customer returns from hosted checkout
- **WHEN** the local attempt is not yet approved
- **THEN** the page MUST report that payment confirmation is still being verified
- **AND** MUST NOT confirm the appointment from query parameters.

### Requirement: Unpaid reservation expiration

An unpaid reservation MUST stop consuming capacity after its configured checkout deadline unless an approved attempt exists.

#### Scenario: Pending checkout expires

- **GIVEN** a pending appointment with no approved attempt
- **WHEN** its checkout deadline passes
- **THEN** the attempt MUST become expired
- **AND** the appointment MUST become cancelled with status history.

### Requirement: Checkout flow follows the credentials

The checkout URL and the expected live mode of a payment MUST follow the configured credentials: application `TEST-` credentials use the sandbox checkout and expect test payments; any `APP_USR-` credentials, including a test seller's, use the regular checkout and expect live-mode payments.

#### Scenario: Test seller credentials

- **GIVEN** `MERCADO_PAGO_ENVIRONMENT` is `test` and the access token is a test seller's `APP_USR-` token
- **WHEN** a deposit checkout is created and later paid by a test buyer
- **THEN** the customer MUST be sent to the regular checkout
- **AND** the approved payment, which arrives in live mode, MUST confirm the appointment.

#### Scenario: Customer email in test mode

- **GIVEN** test credentials
- **WHEN** a preference is created
- **THEN** the customer's real email MUST NOT be sent as payer, so the checkout does not mix a real party with test accounts.

### Requirement: Preview deployments keep payments on themselves

On a preview deployment, the checkout's return URLs and notification URL MUST point to that preview's branch URL, never to the production domain, and the notification MUST be able to pass the deployment protection.

#### Scenario: Paying on a protected preview

- **GIVEN** a preview deployment with Vercel Deployment Protection
- **WHEN** a deposit checkout is created
- **THEN** its return and notification URLs MUST use the preview branch URL
- **AND** the notification URL MUST carry the protection bypass when one is configured.
