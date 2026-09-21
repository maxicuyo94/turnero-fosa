## MODIFIED Requirements

### Requirement: Customer Capture

The system MUST capture enough customer contact data to identify and communicate about an appointment, and MUST reuse an existing customer when the submitted booking identifies one already on record.

Required public booking data for Taller Express SHOULD include name, surname, age, phone, email, vehicle type, vehicle brand, vehicle model, license plate when available, and repair comments for service/reparacion bookings.

#### Scenario: New customer books

- **GIVEN** a public user submits valid contact data
- **WHEN** a booking is created
- **THEN** a customer record MUST be created or reused.

#### Scenario: Returning customer books again

- **GIVEN** a customer whose normalized phone matches the submitted one
- **WHEN** a booking is created
- **THEN** the appointment MUST reference that existing customer
- **AND** no second customer MUST be created for that phone.

#### Scenario: Missing required contact data

- **GIVEN** required contact fields are missing or invalid
- **WHEN** booking is submitted
- **THEN** the appointment MUST NOT be created
- **AND** validation feedback MUST be shown.

### Requirement: Motorcycle Capture

The system MUST associate each appointment with a vehicle profile whose type comes from the configurable vehicle type catalog, and MUST reuse an existing vehicle when the submitted booking identifies one already on record.

#### Scenario: Motorcycle is attached to booking

- **GIVEN** valid vehicle details are submitted
- **WHEN** the appointment is created
- **THEN** the appointment MUST reference that vehicle.

#### Scenario: Repair comments are attached

- **GIVEN** a public user describes a specific repair concern
- **WHEN** the appointment is created
- **THEN** the comment MUST be stored with the appointment notes.

#### Scenario: Booking reuses a vehicle by license plate

- **GIVEN** a vehicle whose normalized license plate matches the submitted one
- **WHEN** a booking is created
- **THEN** the appointment MUST reference that existing vehicle
- **AND** no second vehicle MUST be created for that plate.

#### Scenario: License plate spelling does not create a second unit

- **GIVEN** a stored plate `AB123CD`
- **WHEN** a booking submits `ab 123 cd` or `AB-123-CD`
- **THEN** both MUST resolve to the same vehicle.

#### Scenario: Booking without a license plate

- **GIVEN** a booking that submits no license plate
- **WHEN** the appointment is created
- **THEN** a new vehicle MUST be created
- **AND** internal staff MUST be able to link it to an existing vehicle afterwards.

#### Scenario: Concurrent bookings for the same plate

- **GIVEN** two bookings for the same normalized plate submitted at the same time
- **WHEN** both are processed
- **THEN** exactly one vehicle MUST exist for that plate
- **AND** both appointments MUST reference it.

#### Scenario: Reused records keep their stored data

- **GIVEN** a reused customer or vehicle with data already on record
- **WHEN** a booking submits different values for fields that are already filled
- **THEN** the stored values MUST be preserved
- **AND** only empty fields MAY be completed from the booking.

#### Scenario: Vehicle changes owner

- **GIVEN** a vehicle on record for one customer
- **WHEN** another customer books with that plate
- **THEN** the appointment MUST reference the booking customer
- **AND** the vehicle's current owner MUST become that customer
- **AND** the ownership change MUST be recorded.

## ADDED Requirements

### Requirement: Vehicle Type Catalog

The system MUST let internal staff manage the vehicle type catalog from workshop settings, and MUST NOT hardcode the available types in product code.

#### Scenario: Staff adds a vehicle type

- **GIVEN** an authenticated internal session
- **WHEN** a vehicle type is added from settings
- **THEN** it MUST be selectable in public booking without a deployment.

#### Scenario: Type in use is not deleted

- **GIVEN** a vehicle type referenced by at least one vehicle
- **WHEN** deletion is attempted
- **THEN** the type MUST NOT be deleted
- **AND** it MAY be deactivated instead, keeping existing vehicles readable.

#### Scenario: Existing motorcycles keep their type

- **GIVEN** vehicles created before this change
- **WHEN** the migration runs
- **THEN** every one of them MUST reference the seeded motorcycle type.

### Requirement: Internal Vehicle Identification Fields

The system MUST keep chassis number, engine number, colour and vehicle notes as internal data, captured only from the vehicle record behind internal authentication.

#### Scenario: Public booking does not ask for them

- **GIVEN** a public booking form
- **WHEN** it is rendered
- **THEN** it MUST NOT request chassis number, engine number, colour or vehicle notes
- **AND** the only vehicle field it adds MUST be the vehicle type.

#### Scenario: Staff completes them from the vehicle record

- **GIVEN** an authenticated internal session
- **WHEN** the vehicle record is edited
- **THEN** chassis number, engine number, colour and notes MUST be persisted on that vehicle.

#### Scenario: License plate is not edited from the record

- **GIVEN** a vehicle record
- **WHEN** it is edited
- **THEN** the license plate MUST NOT be editable there, since it identifies the unit.
