-- Removes schema the app never reads. Requested explicitly; review before deploying.

-- Online rescheduling does not exist, so the flag had no effect.
ALTER TABLE "WorkshopSettings" DROP COLUMN "reschedulingEnabled";

-- Auth.js adapter leftovers: sessions are JWT and no adapter is configured, so nothing writes these.
ALTER TABLE "User" DROP COLUMN "emailVerified";
ALTER TABLE "User" DROP COLUMN "image";
DROP TABLE "Account";
DROP TABLE "Session";
DROP TABLE "VerificationToken";
