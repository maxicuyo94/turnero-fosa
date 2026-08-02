CREATE TABLE "AppointmentIntervalHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "previousStartAt" TIMESTAMP(3) NOT NULL,
    "previousEndAt" TIMESTAMP(3) NOT NULL,
    "newStartAt" TIMESTAMP(3) NOT NULL,
    "newEndAt" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "AppointmentIntervalHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentIntervalHistory_appointmentId_changedAt_idx"
ON "AppointmentIntervalHistory"("appointmentId", "changedAt");

ALTER TABLE "AppointmentIntervalHistory"
ADD CONSTRAINT "AppointmentIntervalHistory_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentIntervalHistory"
ADD CONSTRAINT "AppointmentIntervalHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
