## Why

Service duration is currently treated as a fixed appointment duration. In practice it is a useful default—for example, 60 minutes for Service Esencial—but some motorcycles require more workshop time. Customers need to reserve that larger interval up front, and authorized staff need to record that an active appointment will take longer without creating a replacement appointment.

## What Changes

- Keep each service's configured duration as the default appointment duration.
- Let public users request a longer duration before selecting a slot, and recalculate availability for the complete requested interval.
- Let authorized internal users extend a non-terminal appointment from its current duration.
- Reject durations below the service default, public durations that are not aligned to the configured slot step, and internal attempts that shorten or modify terminal appointments.
- Persist the effective duration through the existing `startAt` and `endAt` fields so capacity calculations immediately use the extended interval.

## Capabilities

### Modified Capabilities

- `public-booking`: A booking may request an effective duration longer than the selected service default.
- `booking-availability`: Slot calculation uses the effective requested duration for the entire interval.
- `appointment-management`: Authorized users may extend eligible appointments without changing their start time.

## Impact

This affects public booking query/form state, booking validation and availability calculation, the protected agenda action and UI, internal repository contracts, and automated tests. No database migration is required because appointments already persist their effective interval as `startAt` and `endAt`. Existing appointments retain their current interval. Rollback restores the fixed-duration UI and actions; stored extended intervals remain valid historical appointment data.
