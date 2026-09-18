import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { inventoryCodeCandidates, normalizeScannedCode } from "@/src/modules/shop/inventory-code";
import { InventoryError } from "@/src/modules/shop/inventory-service";

export type InventoryCodeMatch = { id: string; sku: string; barcode: string | null; name: string; location: string | null };

export type InventoryCodeResolution =
  | { status: "found"; product: InventoryCodeMatch }
  | { status: "ambiguous"; code: string; products: InventoryCodeMatch[] }
  | { status: "unknown"; code: string };

/** Un codigo identifica un producto sin modificar stock; si coincide con mas de uno, no adivina. */
export async function resolveInventoryCode(
  prisma: Pick<PrismaClient, "shopProduct">,
  raw: unknown,
): Promise<InventoryCodeResolution | null> {
  const code = normalizeScannedCode(raw);
  if (!code) return null;
  const candidates = inventoryCodeCandidates(code);
  const products = await prisma.shopProduct.findMany({
    where: { OR: [{ barcode: { in: candidates } }, { sku: { in: candidates.map((value) => value.toUpperCase()) } }] },
    select: { id: true, sku: true, barcode: true, name: true, location: true },
    orderBy: { name: "asc" },
  });
  if (products.length === 1) return { status: "found", product: products[0] };
  if (products.length > 1) return { status: "ambiguous", code, products };
  return { status: "unknown", code };
}

const linkBarcodeSchema = z.object({
  productId: z.string().trim().min(1, "Elegí un repuesto.").max(128),
  barcode: z.string().transform((value, ctx) => {
    const code = normalizeScannedCode(value);
    if (!code) {
      ctx.addIssue({ code: "custom", message: "El código leído no es válido." });
      return z.NEVER;
    }
    return code;
  }),
  version: z.coerce.number().int().min(0, "Recargá la página e intentá nuevamente."),
});

/**
 * Asocia un codigo desconocido a un repuesto que todavia no tiene codigo de barras.
 * No reemplaza un codigo existente: eso se hace editando la ficha.
 */
export async function linkInventoryBarcode(prisma: PrismaClient, input: unknown) {
  const parsed = linkBarcodeSchema.parse(input);
  const taken = await prisma.shopProduct.findFirst({
    where: { OR: [
      { barcode: { in: inventoryCodeCandidates(parsed.barcode) } },
      { sku: { in: inventoryCodeCandidates(parsed.barcode).map((value) => value.toUpperCase()) } },
    ] },
    select: { id: true, name: true },
  });
  if (taken) throw new InventoryError(`El código ${parsed.barcode} ya identifica a "${taken.name}".`);

  const result = await prisma.shopProduct.updateMany({
    where: { id: parsed.productId, version: parsed.version, barcode: null },
    data: { barcode: parsed.barcode, version: { increment: 1 } },
  }).catch((error: unknown) => {
    // Otra persona vinculo el mismo codigo entre la verificacion y la escritura.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InventoryError(`El código ${parsed.barcode} ya identifica a otro repuesto.`);
    }
    throw error;
  });
  if (result.count === 1) return prisma.shopProduct.findUniqueOrThrow({ where: { id: parsed.productId } });

  const current = await prisma.shopProduct.findUnique({ where: { id: parsed.productId }, select: { barcode: true } });
  if (!current) throw new InventoryError("No encontramos el producto solicitado.");
  if (current.barcode) throw new InventoryError(`Ese repuesto ya tiene el código ${current.barcode}. Para cambiarlo, editá la ficha.`);
  throw new InventoryError("El producto fue actualizado por otra persona. Recargá la página e intentá de nuevo.");
}
