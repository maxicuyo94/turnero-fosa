# Workshop Settings Specification

## Purpose

Define configurable workshop identity, schedule, capacity, and booking policies.

## ADDED Requirements

### Requirement: Configurable Workshop Profile

Workshop identity, schedule, capacity, booking notice/window, confirmation policy, and cancellation policy MUST be stored as configurable settings, not hardcoded constants.

#### Scenario: Express defaults are seeded

- GIVEN the system is initialized for testing
- WHEN settings are seeded
- THEN Taller de motos Express, B° Parques Nacionales calle Los Cardones 3289, IG Expresstallerdemotos, turnos programados, automatic confirmation, cancellation disabled, rescheduling disabled, 2-hour notice, and 30-day window are available as editable business data.
- AND contact phone/WhatsApp, exact weekly hours, lunch break policy, real concurrent capacity, prices, and deposit handling MUST remain explicit configuration inputs before production launch.

#### Scenario: Settings change affects behavior

- GIVEN an authorized user updates capacity or working hours
- WHEN availability is requested afterward
- THEN the system MUST calculate slots using the updated settings.

### Requirement: MVP Policy Boundaries

The system MUST support automatic confirmation, configurable cancellation policy, and MUST NOT expose online rescheduling in the MVP.

#### Scenario: Rescheduling is unavailable

- GIVEN a public user has an appointment
- WHEN they access self-service actions
- THEN online cancellation MUST NOT be offered when the workshop policy disables it
- AND online rescheduling MUST NOT be offered.

#### Scenario: Deposit policy is visible

- GIVEN Taller Express requires a 5000 ARS deposit
- WHEN a public user requests a booking
- THEN the deposit requirement MUST be communicated before final submission
- AND payment collection MUST be handled by a future payment/deposit capability.
