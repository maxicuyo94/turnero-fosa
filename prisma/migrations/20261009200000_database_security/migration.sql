-- The application accesses PostgreSQL exclusively through its trusted server.
-- Anonymous/third-party DB logins get no rows, even if accidentally granted SELECT.
-- Migration owners bypass RLS; production DATABASE_URL must use a separate non-owner login
-- inheriting fosa_backend. Provision that login in the database secret manager.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fosa_backend') THEN
    CREATE ROLE fosa_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fosa_backend;

DO $$
DECLARE
  table_name text;
  client_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'WorkshopSettings', 'WeeklySchedule', 'ScheduleBreak', 'ScheduleDateException',
    'Service', 'Customer', 'VehicleType', 'Vehicle', 'VehiclePlateChange', 'VehicleOwnerHistory',
    'Appointment', 'DepositPaymentAttempt', 'AppointmentIntervalHistory', 'AppointmentStatusHistory',
    'AppointmentDetailChange', 'User', 'ShopProduct', 'ShopSettings', 'ShopOrder', 'ShopOrderItem',
    'ShopPayment', 'ShopOrderEvent', 'InventoryMovement', 'StockCount', 'StockCountLine', 'LoginThrottle', 'EmailLog'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
    -- Only the server role can access operational rows; application auth further narrows each request.
    EXECUTE format('CREATE POLICY fosa_backend_access ON %I TO fosa_backend USING (true) WITH CHECK (true)', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO fosa_backend', table_name);
    -- If exposed via Supabase/PostgREST later, neither browser role can bypass the backend.
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
