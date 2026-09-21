-- Generic vehicle entity with a configurable type catalog and a plate identity key.
--
-- Motorcycle is RENAMED, never recreated: the rename keeps every id, foreign key and row, so no
-- existing appointment loses its unit. Indexes and constraints are renamed alongside the table to
-- keep the names Prisma expects.

-- 1. Vehicle type catalog.
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "workshopSettingsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleType_workshopSettingsId_name_key" ON "VehicleType"("workshopSettingsId", "name");
CREATE INDEX "VehicleType_workshopSettingsId_isActive_displayOrder_idx" ON "VehicleType"("workshopSettingsId", "isActive", "displayOrder");

ALTER TABLE "VehicleType" ADD CONSTRAINT "VehicleType_workshopSettingsId_fkey"
    FOREIGN KEY ("workshopSettingsId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the only type the workshop has today. Anything else is added from Configuracion.
INSERT INTO "VehicleType" ("id", "workshopSettingsId", "name", "isActive", "displayOrder", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'Moto', true, 1, CURRENT_TIMESTAMP FROM "WorkshopSettings";

-- 2. Motorcycle -> Vehicle, keeping the data in place.
ALTER TABLE "Motorcycle" RENAME TO "Vehicle";
ALTER TABLE "Vehicle" RENAME CONSTRAINT "Motorcycle_pkey" TO "Vehicle_pkey";
ALTER TABLE "Vehicle" RENAME CONSTRAINT "Motorcycle_customerId_fkey" TO "Vehicle_customerId_fkey";
ALTER INDEX "Motorcycle_customerId_idx" RENAME TO "Vehicle_customerId_idx";
ALTER INDEX "Motorcycle_licensePlate_idx" RENAME TO "Vehicle_licensePlate_idx";

ALTER TABLE "Vehicle"
    ADD COLUMN "vehicleTypeId" TEXT,
    ADD COLUMN "plateNormalized" TEXT,
    ADD COLUMN "vin" TEXT,
    ADD COLUMN "engineNumber" TEXT,
    ADD COLUMN "color" TEXT,
    ADD COLUMN "notes" TEXT;

-- 3. Backfill before the column becomes required: every existing unit is a motorcycle.
UPDATE "Vehicle" SET "vehicleTypeId" = (
    SELECT "id" FROM "VehicleType" WHERE "name" = 'Moto' ORDER BY "createdAt" ASC LIMIT 1
) WHERE "vehicleTypeId" IS NULL;

UPDATE "Vehicle"
SET "plateNormalized" = NULLIF(UPPER(REGEXP_REPLACE("licensePlate", '[^A-Za-z0-9]', '', 'g')), '')
WHERE "licensePlate" IS NOT NULL;

ALTER TABLE "Vehicle" ALTER COLUMN "vehicleTypeId" SET NOT NULL;

-- Non-unique on purpose: production still holds one row per booking, so a unique index would fail
-- this migration. The partial unique index ships once those duplicates are merged from the panel.
CREATE INDEX "Vehicle_plateNormalized_idx" ON "Vehicle"("plateNormalized");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey"
    FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A unit outlives its owner's record: it is the current owner, not a belonging.
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_customerId_fkey";
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3b. Customer identity key, indexed for the same reason.
ALTER TABLE "Customer" ADD COLUMN "phoneNormalized" TEXT;

UPDATE "Customer" SET "phoneNormalized" = NULLIF(REGEXP_REPLACE("phone", '[^0-9]', '', 'g'), '');

CREATE INDEX "Customer_phoneNormalized_idx" ON "Customer"("phoneNormalized");

-- 4. Appointment.motorcycleId -> vehicleId.
ALTER TABLE "Appointment" RENAME COLUMN "motorcycleId" TO "vehicleId";
ALTER TABLE "Appointment" RENAME CONSTRAINT "Appointment_motorcycleId_fkey" TO "Appointment_vehicleId_fkey";
ALTER INDEX "Appointment_motorcycleId_idx" RENAME TO "Appointment_vehicleId_idx";

-- 5. Ownership changes are recorded, never silent.
CREATE TABLE "VehicleOwnerHistory" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "previousCustomerId" TEXT,
    "newCustomerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleOwnerHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleOwnerHistory_vehicleId_changedAt_idx" ON "VehicleOwnerHistory"("vehicleId", "changedAt");

ALTER TABLE "VehicleOwnerHistory" ADD CONSTRAINT "VehicleOwnerHistory_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
