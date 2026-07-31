## MODIFIED Requirements

### Requirement: Configurable Workshop Profile

Workshop identity, weekly schedule, breaks, date-specific exceptions, capacity, booking notice/window, confirmation policy, and cancellation policy MUST be stored as configurable settings, not hardcoded constants.

#### Scenario: Express defaults are seeded

- **GIVEN** the system is initialized for testing
- **WHEN** settings are seeded
- **THEN** editable Taller Express defaults MUST be available as business data
- **AND** missing contact, price, and deposit fields MUST remain explicit future configuration work.

#### Scenario: Settings change affects behavior

- **GIVEN** an authorized user updates capacity or working hours
- **WHEN** availability is requested afterward
- **THEN** the system MUST calculate slots using the updated settings.

#### Scenario: Authorized user edits the weekly schedule

- **GIVEN** an authenticated internal user views workshop settings
- **WHEN** they change opening hours, closing hours, open days, or breaks
- **THEN** the system MUST validate and persist the complete schedule
- **AND** subsequent availability MUST use the updated values.

#### Scenario: Authorized user overrides an imported holiday

- **GIVEN** an Argentine national holiday was imported as closed
- **WHEN** an authenticated internal user marks that date as exceptionally open and supplies valid hours
- **THEN** the exception MUST be persisted without changing the recurring weekly schedule.
