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
