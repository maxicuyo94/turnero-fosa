-- Audit trail for confirmed duplicate merges. Additive: no existing table changes.
CREATE TABLE "VehicleMerge" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "sourceVehicleId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "targetVehicleId" TEXT NOT NULL,
    "movedAppointments" INTEGER NOT NULL,
    "mergedById" TEXT,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleMerge_pkey" PRIMARY KEY ("id")
);

-- Makes a resubmitted merge form a no-op instead of a second merge.
CREATE UNIQUE INDEX "VehicleMerge_requestKey_key" ON "VehicleMerge"("requestKey");
CREATE INDEX "VehicleMerge_targetVehicleId_mergedAt_idx" ON "VehicleMerge"("targetVehicleId", "mergedAt");

ALTER TABLE "VehicleMerge" ADD CONSTRAINT "VehicleMerge_targetVehicleId_fkey"
    FOREIGN KEY ("targetVehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMerge" ADD CONSTRAINT "VehicleMerge_mergedById_fkey"
    FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
