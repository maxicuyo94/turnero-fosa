CREATE TYPE "DepositPaymentStatus" AS ENUM (
  'CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED',
  'EXPIRED', 'REFUNDED', 'CHARGED_BACK', 'ERROR'
);

ALTER TABLE "WorkshopSettings"
ADD COLUMN "depositRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "depositAmountCents" INTEGER NOT NULL DEFAULT 500000,
ADD COLUMN "depositExpirationMinutes" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "DepositPaymentAttempt" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
  "externalReference" TEXT NOT NULL,
  "preferenceId" TEXT,
  "providerPaymentId" TEXT,
  "checkoutUrl" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "status" "DepositPaymentStatus" NOT NULL DEFAULT 'CREATED',
  "statusDetail" TEXT,
  "liveMode" BOOLEAN,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "lastNotificationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepositPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepositPaymentAttempt_externalReference_key" ON "DepositPaymentAttempt"("externalReference");
CREATE UNIQUE INDEX "DepositPaymentAttempt_preferenceId_key" ON "DepositPaymentAttempt"("preferenceId");
CREATE UNIQUE INDEX "DepositPaymentAttempt_providerPaymentId_key" ON "DepositPaymentAttempt"("providerPaymentId");
CREATE INDEX "DepositPaymentAttempt_appointmentId_createdAt_idx" ON "DepositPaymentAttempt"("appointmentId", "createdAt");
CREATE INDEX "DepositPaymentAttempt_status_expiresAt_idx" ON "DepositPaymentAttempt"("status", "expiresAt");

ALTER TABLE "DepositPaymentAttempt"
ADD CONSTRAINT "DepositPaymentAttempt_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
