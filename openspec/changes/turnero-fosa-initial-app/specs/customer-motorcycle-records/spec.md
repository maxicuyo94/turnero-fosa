# Customer Motorcycle Records Specification

## Purpose

Define customer contact and motorcycle profile capture for bookings and internal reuse.

## Requirements

### Requirement: Customer Capture

The system MUST capture enough customer contact data to identify and communicate about an appointment.

Required public booking data for Taller Express SHOULD include name, surname, age, phone, email, motorcycle brand, motorcycle model, license plate when available, and repair comments for service/reparacion bookings.

#### Scenario: New customer books

- GIVEN a public user submits valid contact data
- WHEN a booking is created
- THEN a customer record MUST be created or reused.

#### Scenario: Missing required contact data

- GIVEN required contact fields are missing or invalid
- WHEN booking is submitted
- THEN the appointment MUST NOT be created
- AND validation feedback MUST be shown.

### Requirement: Motorcycle Capture

The system MUST associate each appointment with a motorcycle profile.

#### Scenario: Motorcycle is attached to booking

- GIVEN valid motorcycle details are submitted
- WHEN the appointment is created
- THEN the appointment MUST reference that motorcycle.

#### Scenario: Repair comments are attached

- GIVEN a public user describes a specific repair concern
- WHEN the appointment is created
- THEN the comment MUST be stored with the appointment notes.
