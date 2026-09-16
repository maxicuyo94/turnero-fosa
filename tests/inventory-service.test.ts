// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createInventoryProductSchema } from "@/src/modules/shop/inventory-schemas";
import {
  createInventoryProduct,
  InventoryError,
  recordInventoryMovement,
  updateInventoryProduct,
} from "@/src/modules/shop/inventory-service";

type Product = {
  id: string; sku: string; barcode: string | null; name: string; description: string | null; category: string;
  brand: string | null; compatibility: string | null; location: string | null; priceCents: number;
  stock: number; reservedStock: number; minimumStock: number; isActive: boolean; version: number;
};

type Movement = {
  id: string; productId: string; kind: string; quantityDelta: number; stockBefore: number; stockAfter: number;
  reason: string; reference: string | null; actorId: string; requestKey: string; requestFingerprint: string;
};

function inventoryPrisma(products: Product[] = [], movements: Movement[] = []) {
  const state = { products, movements };
  const client = {
    shopProduct: {
      findUnique: async ({ where }: { where: { id?: string; sku?: string; barcode?: string } }) =>
        state.products.find((product) =>
          (where.id === undefined || product.id === where.id) &&
          (where.sku === undefined || product.sku === where.sku) &&
          (where.barcode === undefined || product.barcode === where.barcode),
        ) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const product = state.products.find((item) => item.id === where.id);
        if (!product) throw new Error("not found");
        return product;
      },
      create: async ({ data }: { data: Omit<Product, "id" | "version" | "reservedStock"> }) => {
        if (state.products.some((product) => product.sku === data.sku || (data.barcode && product.barcode === data.barcode))) {
          const error = Object.assign(new Error("duplicate"), { code: "P2002" });
          throw error;
        }
        const product: Product = { id: `product-${state.products.length + 1}`, version: 0, reservedStock: 0, ...data };
        state.products.push(product);
        return product;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const product = state.products.find((item) => item.id === where.id);
        if (!product || product.version !== where.version) return { count: 0 };
        if ("stock" in where && typeof where.stock === "object" && where.stock !== null) {
          const minimum = (where.stock as { gte?: number }).gte;
          if (minimum !== undefined && product.stock < minimum) return { count: 0 };
        }
        if ("reservedStock" in where && typeof where.reservedStock === "object" && where.reservedStock !== null) {
          const maximum = (where.reservedStock as { lte?: number }).lte;
          if (maximum !== undefined && product.reservedStock > maximum) return { count: 0 };
        }
        for (const [key, value] of Object.entries(data)) {
          if (key === "stock" && typeof value === "object" && value !== null) product.stock += (value as { increment?: number }).increment ?? 0;
          else if (key === "version" && typeof value === "object" && value !== null) product.version += (value as { increment?: number }).increment ?? 0;
          else (product as Record<string, unknown>)[key] = value;
        }
        return { count: 1 };
      },
    },
    inventoryMovement: {
      findUnique: async ({ where }: { where: { requestKey: string } }) => state.movements.find((movement) => movement.requestKey === where.requestKey) ?? null,
      create: async ({ data }: { data: Omit<Movement, "id"> }) => {
        if (state.movements.some((movement) => movement.requestKey === data.requestKey)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        const movement = { id: `movement-${state.movements.length + 1}`, ...data };
        state.movements.push(movement);
        return movement;
      },
    },
  };
  return { state, prisma: { ...client, $transaction: async (operation: (tx: typeof client) => unknown) => operation(client) } as unknown as PrismaClient };
}

const createInput = () => ({
  sku: "  filtro-001 ", barcode: " 000123 ", name: "Filtro de aceite", description: " ", category: "Filtros",
  brand: "Honda", compatibility: "CG 150", location: "A-2", priceArs: "1234,50", initialStock: "3", minimumStock: "1",
  isActive: true, requestKey: randomUUID(),
});

describe("inventory service", () => {
  it.each([null, true, false, {}, [], "", "1.5", "-1"])("rejects non-integer stock inputs: %j", (initialStock) => {
    expect(createInventoryProductSchema.safeParse({ ...createInput(), initialStock }).success).toBe(false);
  });

  it("rejects a receipt above the supported stock limit before writing", async () => {
    const { prisma, state } = inventoryPrisma();
    const product = await createInventoryProduct(prisma, { ...createInput(), initialStock: 999999 }, "user-1");
    await expect(recordInventoryMovement(prisma, { productId: product.id, kind: "RECEIPT", quantity: 2, reason: "Ingreso", version: 0, requestKey: randomUUID() }, "user-1"))
      .rejects.toThrow("El stock físico no puede superar 1.000.000 de unidades.");
    expect(state.products[0].stock).toBe(999999);
    expect(state.movements).toHaveLength(1);
  });
  it("normaliza la ficha, crea el stock inicial y deja una auditoría", async () => {
    const { prisma, state } = inventoryPrisma();
    const product = await createInventoryProduct(prisma, createInput(), "user-1");

    expect(product).toMatchObject({ sku: "FILTRO-001", barcode: "000123", description: null, priceCents: 123450, stock: 3, version: 0 });
    expect(state.movements).toEqual([expect.objectContaining({ kind: "INITIAL", quantityDelta: 3, stockBefore: 0, stockAfter: 3, reason: "Stock inicial", actorId: "user-1" })]);
  });

  it("devuelve el resultado idempotente antes de comprobar una versión ya vencida", async () => {
    const { prisma, state } = inventoryPrisma([{
      id: "product-1", sku: "BATERIA", barcode: null, name: "Batería", description: null, category: "Eléctrico", brand: null,
      compatibility: null, location: null, priceCents: 1000, stock: 5, reservedStock: 0, minimumStock: 0, isActive: true, version: 4,
    }]);
    const input = { productId: "product-1", kind: "RECEIPT", quantity: 2, reason: "Compra", reference: "OC-1", version: 4, requestKey: randomUUID() };
    await recordInventoryMovement(prisma, input, "user-1");
    const again = await recordInventoryMovement(prisma, input, "user-1");

    expect(again.stock).toBe(7);
    expect(state.movements).toHaveLength(1);
  });

  it("no consume unidades reservadas y no escribe un movimiento parcial", async () => {
    const { prisma, state } = inventoryPrisma([{
      id: "product-1", sku: "CADENA", barcode: null, name: "Cadena", description: null, category: "Transmisión", brand: null,
      compatibility: null, location: null, priceCents: 1000, stock: 5, reservedStock: 4, minimumStock: 0, isActive: true, version: 0,
    }]);

    await expect(recordInventoryMovement(prisma, { productId: "product-1", kind: "REPAIR", quantity: 2, reason: "OT-1", version: 0, requestKey: randomUUID() }, "user-1"))
      .rejects.toMatchObject({ message: "No hay stock disponible suficiente para registrar el consumo." } satisfies Partial<InventoryError>);
    expect(state.products[0]).toMatchObject({ stock: 5, version: 0 });
    expect(state.movements).toHaveLength(0);
  });

  it("rechaza una edición con versión vencida sin cambiar el producto", async () => {
    const { prisma, state } = inventoryPrisma([{
      id: "product-1", sku: "BUJIA", barcode: null, name: "Bujía", description: null, category: "Encendido", brand: null,
      compatibility: null, location: null, priceCents: 1000, stock: 2, reservedStock: 0, minimumStock: 0, isActive: true, version: 1,
    }]);
    await expect(updateInventoryProduct(prisma, { ...createInput(), id: "product-1", version: 0, sku: "BUJIA", name: "Bujía premium" }))
      .rejects.toThrow("El producto fue actualizado por otra persona. Recargá la página e intentá de nuevo.");
    expect(state.products[0].name).toBe("Bujía");
  });

  it.each(["1.000", "1,234.50", "0", "1000000.01", "12.345,678"])("rechaza precios no permitidos: %s", async (priceArs) => {
    const { prisma } = inventoryPrisma();
    await expect(createInventoryProduct(prisma, { ...createInput(), priceArs }, "user-1")).rejects.toBeTruthy();
  });
});
