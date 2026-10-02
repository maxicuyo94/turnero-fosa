import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { listLabelProducts } from "@/src/modules/shop/inventory-queries";
import { parseInventoryFilters } from "@/src/modules/shop/inventory-filters";

type Row = { id: string; stock: number; reservedStock: number; minimumStock: number };

/** Mimics findMany's `take` so the test sees what the database would hand back. */
function fakePrisma(rows: Row[]) {
  return {
    shopProduct: {
      findMany: async ({ take }: { take?: number }) => (take === undefined ? rows : rows.slice(0, take)),
    },
  } as unknown as Pick<PrismaClient, "shopProduct">;
}

describe("label selection", () => {
  it("keeps low-stock products that sort after the limit", async () => {
    // Four healthy products first, then two at their minimum.
    const rows: Row[] = [
      ...Array.from({ length: 4 }, (_, index) => ({ id: `ok-${index}`, stock: 10, reservedStock: 0, minimumStock: 1 })),
      { id: "low-1", stock: 1, reservedStock: 0, minimumStock: 2 },
      { id: "low-2", stock: 0, reservedStock: 0, minimumStock: 1 },
    ];

    const selected = await listLabelProducts(fakePrisma(rows), { filters: parseInventoryFilters({ status: "low" }) }, 3);

    expect(selected.map((row) => row.id)).toEqual(["low-1", "low-2"]);
  });

  it("still cuts the other selections in the query", async () => {
    const rows: Row[] = Array.from({ length: 5 }, (_, index) => ({ id: `p-${index}`, stock: 10, reservedStock: 0, minimumStock: 1 }));
    const selected = await listLabelProducts(fakePrisma(rows), { filters: parseInventoryFilters({}) }, 3);
    expect(selected).toHaveLength(3);
  });
});
