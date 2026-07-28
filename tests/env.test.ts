import { describe, expect, it } from "vitest";
import { getEnv } from "@/src/lib/env";

const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/turnero_fosa",
  AUTH_SECRET: "a-valid-secret-with-at-least-32-chars",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Taller Express <turnos@example.com>",
};

describe("getEnv", () => {
  it("returns typed application configuration", () => {
    expect(getEnv(validEnv)).toEqual(validEnv);
  });

  it("fails with an actionable configuration error", () => {
    expect(() => getEnv({ ...validEnv, DATABASE_URL: "" })).toThrow(
      /Invalid application configuration.*DATABASE_URL/u,
    );
  });
});
