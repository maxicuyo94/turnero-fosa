-- CreateEnum
CREATE TYPE "AppointmentDetailField" AS ENUM ('CUSTOMER_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'APPOINTMENT_NOTES');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "detailVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "detailVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AppointmentDetailChange" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "field" "AppointmentDetailField" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentDetailChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentDetailChange_customerId_changedAt_idx" ON "AppointmentDetailChange"("customerId", "changedAt");

-- CreateIndex
CREATE INDEX "AppointmentDetailChange_appointmentId_changedAt_idx" ON "AppointmentDetailChange"("appointmentId", "changedAt");

-- AddForeignKey
ALTER TABLE "AppointmentDetailChange" ADD CONSTRAINT "AppointmentDetailChange_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentDetailChange" ADD CONSTRAINT "AppointmentDetailChange_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentDetailChange" ADD CONSTRAINT "AppointmentDetailChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
