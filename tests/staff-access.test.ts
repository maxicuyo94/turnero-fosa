// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  users: new Map<string, { id: string; name: string | null; username: string | null; email: string; role: "ADMIN" | "STAFF" }>(),
}));

vi.mock("@/src/lib/auth", () => ({
  auth: mocks.auth,
  getInternalSessionUserId: (session: { user?: { id?: string } } | null) => session?.user?.id ?? null,
}));
vi.mock("@/src/lib/db", () => ({
  db: { user: { findUnique: async ({ where }: { where: { id: string } }) => mocks.users.get(where.id) ?? null } },
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { getStaffMember, hasRole, requireStaff } from "@/src/lib/staff-access";

describe("internal staff access", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.users.clear();
    mocks.users.set("admin-1", { id: "admin-1", name: "Ada", username: "ada", email: "ada@taller.test", role: "ADMIN" });
    mocks.users.set("staff-1", { id: "staff-1", name: null, username: "mecanico", email: "mec@taller.test", role: "STAFF" });
  });

  it("sends anonymous callers to the login", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireStaff()).rejects.toThrow("redirect:/internal/login");
  });

  it("does not trust a token whose account no longer exists", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "deleted-user" } });
    await expect(requireStaff()).rejects.toThrow("redirect:/internal/login");
    expect(await getStaffMember()).toBeNull();
  });

  it("reads the role from the account and names the member for the header", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    await expect(requireStaff()).resolves.toEqual({ userId: "staff-1", displayName: "mecanico", role: "STAFF" });
  });

  it("keeps administration to administrators", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    await expect(requireStaff({ role: "ADMIN" })).rejects.toThrow("redirect:/internal?feedback=forbidden");

    mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
    await expect(requireStaff({ role: "ADMIN" })).resolves.toMatchObject({ userId: "admin-1", role: "ADMIN" });
  });

  it("treats administrators as staff too", () => {
    expect(hasRole({ role: "ADMIN" }, "STAFF")).toBe(true);
    expect(hasRole({ role: "STAFF" }, "STAFF")).toBe(true);
    expect(hasRole({ role: "STAFF" }, "ADMIN")).toBe(false);
  });
});
