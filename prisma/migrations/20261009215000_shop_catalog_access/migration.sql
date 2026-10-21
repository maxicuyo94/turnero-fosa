-- Catalog writes follow the same trusted-backend policy as inventory.
DO $$
DECLARE table_name text; client_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ShopProductImage', 'ShopVehicleModel', 'ShopProductFitment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = 'fosa_backend_access') THEN
      EXECUTE format('CREATE POLICY fosa_backend_access ON %I TO fosa_backend USING (true) WITH CHECK (true)', table_name);
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO fosa_backend', table_name);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
