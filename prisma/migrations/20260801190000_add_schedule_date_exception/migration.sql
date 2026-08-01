-- CreateEnum
CREATE TYPE "ScheduleExceptionSource" AS ENUM ('IMPORTED', 'MANUAL');

-- CreateTable
CREATE TABLE "ScheduleDateException" (
    "id" TEXT NOT NULL,
    "workshopSettingsId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT,
    "source" "ScheduleExceptionSource" NOT NULL DEFAULT 'MANUAL',
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleDateException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleDateException_workshopSettingsId_date_idx" ON "ScheduleDateException"("workshopSettingsId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDateException_workshopSettingsId_date_key" ON "ScheduleDateException"("workshopSettingsId", "date");

-- AddForeignKey
ALTER TABLE "ScheduleDateException" ADD CONSTRAINT "ScheduleDateException_workshopSettingsId_fkey" FOREIGN KEY ("workshopSettingsId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
