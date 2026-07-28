import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: async () => null, signIn: async () => undefined, signOut: async () => undefined }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));

import { createPasswordHash, getInternalSessionUserId, isInternalSession, verifyPassword } from "@/src/lib/auth";

describe("internal authentication boundary", () => {
  it("verifies an admin password against the stored hash", async () => {
    const hash = await createPasswordHash("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("accepts only sessions with an email-bearing user", () => {
    expect(isInternalSession({ user: { id: "user_1", email: "admin@fosa.test" } })).toBe(true);
    expect(isInternalSession({ user: { email: null } })).toBe(false);
    expect(isInternalSession(null)).toBe(false);
  });

  it("extracts the authenticated internal user id when Auth.js exposes one", () => {
    expect(getInternalSessionUserId({ user: { id: "user_1", email: "admin@fosa.test" } })).toBe("user_1");
    expect(getInternalSessionUserId({ user: { id: "", email: "admin@fosa.test" } })).toBeNull();
    expect(getInternalSessionUserId({ user: { email: "admin@fosa.test" } })).toBeNull();
  });
});
