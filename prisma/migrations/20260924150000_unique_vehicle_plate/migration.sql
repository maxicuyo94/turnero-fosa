-- VEH-001: a plate identifies one unit. Before this, every booking created its own unit; stop with a
-- clear message if duplicates remain instead of failing on the index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Vehicle" WHERE "plateNormalized" IS NOT NULL
    GROUP BY "plateNormalized" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Quedan patentes repetidas en "Vehicle": resolvelas antes de migrar.';
  END IF;
END $$;

-- Partial: units without a plate have nothing to match on and may repeat. Prisma cannot declare a
-- partial index, so the schema keeps @@index([plateNormalized]) and this one lives only in SQL.
CREATE UNIQUE INDEX "Vehicle_plateNormalized_key" ON "Vehicle"("plateNormalized") WHERE "plateNormalized" IS NOT NULL;

-- Merging existed only to clean those duplicates; with the plate unique it has nothing left to do.
DROP TABLE "VehicleMerge";
