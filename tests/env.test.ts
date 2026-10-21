import { describe, expect, it } from "vitest";
import { getDatabaseUrl, getNotificationEnv } from "@/src/lib/env";

describe("environment readers", () => {
  it("requires TLS for production database connections", () => {
    const env = { NODE_ENV: "production", DATABASE_URL: "postgresql://user:password@localhost/db" };
    expect(() => getDatabaseUrl(env)).toThrow(/TLS/u);
    expect(() => getDatabaseUrl({ ...env, DATABASE_URL: env.DATABASE_URL + "?sslmode=disable" })).toThrow(/TLS/u);
    expect(getDatabaseUrl({ ...env, DATABASE_URL: env.DATABASE_URL + "?sslmode=require" })).toContain("sslmode=verify-full");
    expect(getDatabaseUrl({ ...env, DATABASE_URL: env.DATABASE_URL + "?sslmode=require&uselibpqcompat=true" })).not.toContain("uselibpqcompat");
  });
  it("returns the database URL and refuses an empty one", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/turnero_fosa";
    expect(getDatabaseUrl({ DATABASE_URL: url })).toBe(url);
    expect(() => getDatabaseUrl({ DATABASE_URL: "" })).toThrow(/DATABASE_URL is required/u);
  });

  it("treats email delivery as off until both provider values are present", () => {
    expect(getNotificationEnv({})).toBeNull();
    expect(getNotificationEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Taller <turnos@example.com>" })).toEqual({
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Taller <turnos@example.com>",
    });
    expect(() => getNotificationEnv({ RESEND_API_KEY: "re_test" })).toThrow();
  });
});
