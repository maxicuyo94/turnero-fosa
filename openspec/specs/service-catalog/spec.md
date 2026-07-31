# service-catalog Specification

## Purpose
Define bookable workshop services and their visibility in booking flows.
## Requirements
### Requirement: Configurable Bookable Services

The system MUST manage services with name, duration, active visibility, and display order.

#### Scenario: Seed services are available

- GIVEN test data is seeded
- WHEN the service catalog is viewed
- THEN Service Esencial 60, Service Deluxe 240, Reparaciones generales, Reparacion de motor, Enderezado de chasis, and Enderezado de barrales are available as configurable services.
- AND any repair service without a confirmed duration MUST be reviewed before production availability.

#### Scenario: Prices are optional

- GIVEN the workshop chooses whether to show prices
- WHEN a service is shown publicly
- THEN the price MAY be hidden.

#### Scenario: Inactive service is hidden publicly

- GIVEN a service is inactive
- WHEN a public user selects a service
- THEN that service MUST NOT appear as bookable
- AND existing appointments for it remain visible internally.

### Requirement: Duration Drives Booking

Service duration MUST determine the time occupied by an appointment.

#### Scenario: Long service consumes matching capacity

- GIVEN a 120-minute service is selected
- WHEN availability is calculated
- THEN only slots that can fit the full 120 minutes MUST be offered.

