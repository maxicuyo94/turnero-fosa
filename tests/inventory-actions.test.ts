// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  movement: vi.fn(),
  importProducts: vi.fn(),
  parseExcel: vi.fn(),
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
  importInventoryProducts: mocks.importProducts,
  updateInventoryProduct: mocks.update,
  recordInventoryMovement: mocks.movement,
}));
vi.mock("@/src/modules/shop/inventory-excel", () => ({
  InventoryExcelError: class extends Error { issues: string[] = []; },
  parseInventoryExcel: mocks.parseExcel,
}));

import { createInventoryProductAction, importInventoryExcelAction, recordInventoryMovementAction, updateInventoryProductAction } from "@/app/(internal)/internal/shop/actions";
import { InventoryExcelError } from "@/src/modules/shop/inventory-excel";

describe("inventory server action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "part-1" });
    mocks.update.mockResolvedValue({ id: "part-1" });
    mocks.movement.mockResolvedValue({ id: "part-1" });
    mocks.parseExcel.mockResolvedValue([{ sku: "EXCEL-1" }]);
    mocks.importProducts.mockResolvedValue({ count: 1, initialUnits: 2 });
  });

  it.each([createInventoryProductAction, updateInventoryProductAction, recordInventoryMovementAction, importInventoryExcelAction])("rejects direct anonymous calls before accessing inventory", async (action) => {
    await expect(action({ status: "idle" }, new FormData())).rejects.toThrow("redirect:/internal/login");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.movement).not.toHaveBeenCalled();
    expect(mocks.importProducts).not.toHaveBeenCalled();
  });

  it("imports the uploaded workbook under the authenticated user", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    const data = new FormData();
    data.set("file", new File(["xlsx"], "repuestos.xlsx"));
    const result = await importInventoryExcelAction({ status: "idle" }, data);
    expect(mocks.parseExcel).toHaveBeenCalled();
    expect(mocks.importProducts).toHaveBeenCalledWith(mocks.db, [{ sku: "EXCEL-1" }], "staff-1");
    expect(result).toMatchObject({ status: "success", importedCount: 1 });
  });

  it("rejects a missing file without accessing the importer", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    expect(await importInventoryExcelAction({ status: "idle" }, new FormData())).toMatchObject({ status: "error" });
    expect(mocks.parseExcel).not.toHaveBeenCalled();
    expect(mocks.importProducts).not.toHaveBeenCalled();
  });

  it("returns row errors without writing or refreshing inventory", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "staff-1" } });
    const error = new InventoryExcelError("Archivo inválido");
    error.issues.push("Fila 5 · Stock inicial: La cantidad no puede ser negativa.");
    mocks.parseExcel.mockRejectedValueOnce(error);
    const data = new FormData();
    data.set("file", new File(["xlsx"], "repuestos.xlsx"));
    expect(await importInventoryExcelAction({ status: "idle" }, data)).toMatchObject({ status: "error", issues: error.issues });
    expect(mocks.importProducts).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
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
