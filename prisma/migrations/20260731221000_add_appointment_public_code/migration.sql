BEGIN;

ALTER TABLE "Appointment" ADD COLUMN "publicCode" TEXT;

CREATE FUNCTION generate_appointment_public_code() RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('appointment_public_code'));

  LOOP
    SELECT string_agg(
      substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 32)::integer + 1, 1),
      ''
    )
    INTO candidate
    FROM generate_series(1, 10);

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM "Appointment" WHERE "publicCode" = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE FUNCTION set_appointment_public_code() RETURNS trigger AS $$
BEGIN
  IF NEW."publicCode" IS NULL THEN
    NEW."publicCode" := generate_appointment_public_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Appointment_set_publicCode"
BEFORE INSERT ON "Appointment"
FOR EACH ROW
EXECUTE FUNCTION set_appointment_public_code();

DO $$
DECLARE
  appointment_id TEXT;
BEGIN
  FOR appointment_id IN SELECT "id" FROM "Appointment" WHERE "publicCode" IS NULL LOOP
    UPDATE "Appointment"
    SET "publicCode" = generate_appointment_public_code()
    WHERE "id" = appointment_id;
  END LOOP;
END;
$$;

ALTER TABLE "Appointment"
  ALTER COLUMN "publicCode" SET DEFAULT generate_appointment_public_code(),
  ALTER COLUMN "publicCode" SET NOT NULL,
  ADD CONSTRAINT "Appointment_publicCode_format" CHECK ("publicCode" ~ '^[A-HJ-NP-Z2-9]{10}$');

CREATE UNIQUE INDEX "Appointment_publicCode_key" ON "Appointment"("publicCode");

COMMIT;
