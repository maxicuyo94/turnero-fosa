-- Contact email per appointment: public bookings no longer write their email onto an existing customer.
ALTER TABLE "Appointment" ADD COLUMN "contactEmail" TEXT;

-- Bumping the version invalidates every session token issued before (password change).
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Matches the seed: online cancellation stays off until the workshop enables it.
ALTER TABLE "WorkshopSettings" ALTER COLUMN "cancellationEnabled" SET DEFAULT false;
