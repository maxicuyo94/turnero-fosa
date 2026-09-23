-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'STAFF');

-- AlterTable: new accounts start with the least privilege.
ALTER TABLE "User" ADD COLUMN "role" "StaffRole" NOT NULL DEFAULT 'STAFF';

-- Every account created before roles existed was an administrator; none loses access.
UPDATE "User" SET "role" = 'ADMIN';
