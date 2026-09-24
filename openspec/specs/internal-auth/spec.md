# internal-auth Specification

## Purpose
Define the boundary between public booking and protected workshop operations.
## Requirements
### Requirement: Protected Internal Panel

Internal appointment management, settings, and catalog operations MUST require authenticated workshop access.

#### Scenario: Unauthenticated internal access

- GIVEN a user is not authenticated
- WHEN they request an internal route
- THEN access MUST be denied or redirected to login.

#### Scenario: Authenticated internal access

- GIVEN a workshop user is authenticated
- WHEN they request the internal agenda
- THEN the agenda MUST be accessible.

### Requirement: Public Boundary

Public users MUST be able to view public booking pages without internal privileges and MUST NOT access internal data or mutations.

#### Scenario: Public booking without login

- GIVEN a public user is not logged in
- WHEN they select a service and slot
- THEN public booking MAY continue.

#### Scenario: Public user attempts internal mutation

- GIVEN a public user lacks workshop access
- WHEN they attempt status or settings changes
- THEN the operation MUST be rejected.

### Requirement: Staff Roles

Every internal account MUST have a role. `STAFF` MUST be able to run the agenda, vehicles, inventory and their own account; only `ADMIN` MUST be able to change workshop settings, services, vehicle types, hours, special dates and holiday imports.

#### Scenario: Staff member opens settings

- GIVEN an authenticated account with the `STAFF` role
- WHEN they open the settings section or call a settings action
- THEN the settings MUST NOT be shown and the action MUST be rejected.

#### Scenario: Role read on every request

- GIVEN an account whose role changed or that was deleted after signing in
- WHEN it makes its next internal request
- THEN access MUST follow the stored account, not the session token.

#### Scenario: New accounts start with least privilege

- GIVEN an internal account is created without an explicit role
- WHEN it signs in
- THEN it MUST have the `STAFF` role.
