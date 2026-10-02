import "dotenv/config";
import "@testing-library/jest-dom/vitest";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

// Integration tests rewrite workshop settings and delete rows in DATABASE_URL. They only run against
// a local or explicitly allowlisted database, the same rule that guards the test-data loader.
if (process.env.DATABASE_URL) {
  const target = resolveTestDataTarget({ profile: "development", env: { ...process.env, NODE_ENV: "test" } });
  if (!target.allowed) {
    throw new Error(`[tests] ${target.reason}: ${target.message} Apuntá DATABASE_URL a una base local antes de correr los tests.`);
  }
}
