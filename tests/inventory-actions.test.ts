// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  movement: vi.fn(),
  revalidate: vi.fn(),
  db: {},
}));

vi.mock("@/src/lib/auth", () => ({
  auth: mocks.auth,
  isInternalSession: (session: { user?: { id?: string } } | null) => Boolean(session?.user?.id),
  getInternalSessionUserId: (session: { user?: { id?: string } } | null) => session?.user?.id ?? null,
}));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/src/modules/shop/inventory-service", () => ({
  InventoryError: class extends Error {},
  createInventoryProduct: mocks.create,
  updateInventoryProduct: mocks.update,
  recordInventoryMovement: mocks.movement,
}));

import { createInventoryProductAction, recordInventoryMovementAction, updateInventoryProductAction } from "@/app/(internal)/internal/shop/actions";

describe("inventory server action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "part-1" });
    mocks.update.mockResolvedValue({ id: "part-1" });
    mocks.movement.mockResolvedValue({ id: "part-1" });
  });

  it.each([createInventoryProductAction, updateInventoryProductAction, recordInventoryMovementAction])("rejects direct anonymous calls before accessing inventory", async (action) => {
    await expect(action({ status: "idle" }, new FormData())).rejects.toThrow("redirect:/internal/login");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.movement).not.toHaveBeenCalled();
  });

  it("attributes a movement to the session user, ignoring a submitted actor", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    const data = new FormData();
    for (const [key, value] of Object.entries({ productId: "part-1", actorId: "someone-else", kind: "RECEIPT", quantity: "2", reason: "Ingreso", version: "0", requestKey: "request-1" })) data.set(key, value);
    await recordInventoryMovementAction({ status: "idle" }, data);
    expect(mocks.movement).toHaveBeenCalledWith(mocks.db, expect.objectContaining({ productId: "part-1", quantity: "2" }), "staff-1");
    expect(mocks.movement.mock.calls[0][1]).not.toHaveProperty("actorId");
  });

  it("does not accept stock changes through the product metadata form", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    const data = new FormData();
    data.set("id", "part-1");
    data.set("stock", "999");
    data.set("reservedStock", "0");
    data.set("initialStock", "999");
    await updateInventoryProductAction({ status: "idle" }, data);
    const input = mocks.update.mock.calls[0][1];
    expect(input).not.toHaveProperty("stock");
    expect(input).not.toHaveProperty("reservedStock");
    expect(input).not.toHaveProperty("initialStock");
  });
});
