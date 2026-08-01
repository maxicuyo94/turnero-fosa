import { describe, expect, it } from "vitest";
import { resolveTestDataTarget } from "@/src/modules/testing/test-data-guard";

const localUrl = "postgresql://postgres:sup3rsecret@localhost:5432/turnero_fosa";
const neonUrl = "postgresql://neon:sup3rsecret@ep-cool-branch-123.us-east-2.aws.neon.tech/turnero_fosa";
const productionUrl = "postgresql://neon:sup3rsecret@ep-main-999.us-east-2.aws.neon.tech/turnero_fosa_production";

describe("resolveTestDataTarget", () => {
  it("allows the known profile against the local Docker database", () => {
    const result = resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: localUrl, NODE_ENV: "development" } });

    expect(result).toMatchObject({ allowed: true, profile: "development", host: "localhost" });
  });

  it("refuses to run in a production environment even against a local database", () => {
    expect(resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: localUrl, NODE_ENV: "production" } })).toMatchObject({
      allowed: false,
      reason: "PRODUCTION_ENVIRONMENT",
    });
    expect(
      resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: localUrl, NODE_ENV: "development", VERCEL_ENV: "production" } }),
    ).toMatchObject({ allowed: false, reason: "PRODUCTION_ENVIRONMENT" });
  });

  it("refuses a remote database that the operator did not allowlist", () => {
    expect(resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: neonUrl, NODE_ENV: "development" } })).toMatchObject({
      allowed: false,
      reason: "TARGET_NOT_ALLOWED",
    });
  });

  it("allows an explicitly allowlisted non-production branch", () => {
    const result = resolveTestDataTarget({
      profile: "development",
      env: {
        DATABASE_URL: neonUrl,
        NODE_ENV: "development",
        TEST_DATA_ALLOWED_HOSTS: "ep-cool-branch-123.us-east-2.aws.neon.tech, ep-other.neon.tech",
      },
    });

    expect(result).toMatchObject({ allowed: true, host: "ep-cool-branch-123.us-east-2.aws.neon.tech" });
  });

  it("refuses a target that looks like production even when it is allowlisted", () => {
    expect(
      resolveTestDataTarget({
        profile: "development",
        env: {
          DATABASE_URL: productionUrl,
          NODE_ENV: "development",
          TEST_DATA_ALLOWED_HOSTS: "ep-main-999.us-east-2.aws.neon.tech",
        },
      }),
    ).toMatchObject({ allowed: false, reason: "PRODUCTION_TARGET" });
  });

  it("refuses an unknown profile and an unusable connection string", () => {
    expect(resolveTestDataTarget({ profile: "staging-dump", env: { DATABASE_URL: localUrl } })).toMatchObject({
      allowed: false,
      reason: "UNKNOWN_PROFILE",
    });
    expect(resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: "not-a-url" } })).toMatchObject({
      allowed: false,
      reason: "INVALID_DATABASE_URL",
    });
  });

  it("never leaks the connection string or its credentials in the report", () => {
    const results = [
      resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: productionUrl, NODE_ENV: "production" } }),
      resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: neonUrl, NODE_ENV: "development" } }),
      resolveTestDataTarget({ profile: "development", env: { DATABASE_URL: localUrl, NODE_ENV: "development" } }),
    ];

    for (const result of results) {
      expect(JSON.stringify(result)).not.toContain("sup3rsecret");
    }
  });
});
