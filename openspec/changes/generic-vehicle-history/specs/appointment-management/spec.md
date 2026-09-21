## ADDED Requirements

### Requirement: Vehicle History

The system MUST show internal staff the full appointment history of a vehicle behind internal
authentication.

#### Scenario: Staff opens a vehicle record

- **GIVEN** a vehicle with several past appointments
- **WHEN** internal staff opens its record
- **THEN** every appointment MUST be listed newest first with its date, service, final status and notes.

#### Scenario: Agenda links to the unit

- **GIVEN** an appointment shown in the internal agenda
- **WHEN** staff opens its detail
- **THEN** a link to that vehicle's history MUST be available.

#### Scenario: Unauthenticated access is refused

- **GIVEN** no internal session
- **WHEN** a vehicle record or search is requested
- **THEN** the data MUST NOT be disclosed.

#### Scenario: Vehicle search

- **GIVEN** vehicles on record
- **WHEN** staff searches by plate, brand, model or customer
- **THEN** the matching vehicles MUST be listed.

### Requirement: Duplicate Vehicle Merge

The system MUST let internal staff merge duplicated vehicles explicitly, and MUST NOT merge records
automatically.

#### Scenario: Duplicates are proposed, not merged

- **GIVEN** two vehicles sharing a normalized plate
- **WHEN** the vehicle list is opened
- **THEN** both MUST be reported as possible duplicates
- **AND** neither MUST be modified until a person confirms.

#### Scenario: Confirmed merge moves the history

- **GIVEN** a confirmed merge of a source vehicle into a target
- **WHEN** it is applied
- **THEN** every appointment of the source MUST reference the target
- **AND** empty target fields MAY be completed from the source
- **AND** the source MUST no longer exist.

#### Scenario: Repeated merge request

- **GIVEN** a merge request key that was already applied
- **WHEN** it is submitted again
- **THEN** no second merge MUST be applied.
