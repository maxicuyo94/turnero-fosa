-- The email log becomes an outbox: rows keep what to send and when to try again.
ALTER TABLE "EmailLog" ADD COLUMN "subject" TEXT,
ADD COLUMN "body" TEXT,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "sentAt" TIMESTAMP(3);

-- Earlier rows were only ever written as SENT or FAILED, so none becomes due for delivery.
CREATE INDEX "EmailLog_status_nextAttemptAt_idx" ON "EmailLog"("status", "nextAttemptAt");
