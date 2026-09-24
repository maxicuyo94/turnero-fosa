-- CreateTable
CREATE TABLE "VehiclePlateChange" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "previousPlate" TEXT,
    "newPlate" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePlateChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehiclePlateChange_vehicleId_changedAt_idx" ON "VehiclePlateChange"("vehicleId", "changedAt");

-- AddForeignKey
ALTER TABLE "VehiclePlateChange" ADD CONSTRAINT "VehiclePlateChange_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePlateChange" ADD CONSTRAINT "VehiclePlateChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
