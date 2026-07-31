## ADDED Requirements

### Requirement: Safe Test Data Profiles

The system MUST provide explicit, idempotent test-data profiles for local and non-production databases and MUST refuse to load those profiles into production.

#### Scenario: Development profile is loaded repeatedly

- **GIVEN** the database is explicitly identified as local or non-production
- **WHEN** an operator loads the development profile more than once
- **THEN** deterministic admin, settings, services, schedules, and sample appointments MUST be available
- **AND** duplicate records MUST NOT accumulate.

#### Scenario: Test profile targets production

- **GIVEN** the target is the production Neon branch or production mode is enabled
- **WHEN** an operator attempts to load test data
- **THEN** the command MUST stop before writing any record
- **AND** report that test data is forbidden in production.

#### Scenario: Secrets remain external

- **GIVEN** a test profile requires an administrator credential
- **WHEN** the profile is loaded
- **THEN** the password MUST come from environment configuration
- **AND** no secret value MUST be committed to the repository or printed in logs.
