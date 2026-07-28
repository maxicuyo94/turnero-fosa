# Internal Auth Specification

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
