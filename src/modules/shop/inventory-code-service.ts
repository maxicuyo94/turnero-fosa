import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { compactInventoryCode, inventoryCodeCandidates, normalizeScannedCode } from "@/src/modules/shop/inventory-code";
import { InventoryError } from "@/src/modules/shop/inventory-service";

export type InventoryCodeMatch = { id: string; sku: string; barcode: string | null; name: string; location: string | null };

export type InventoryCodeResolution =
  | { status: "found"; product: InventoryCodeMatch }
  | { status: "ambiguous"; code: string; products: InventoryCodeMatch[] }
  | { status: "unknown"; code: string };

// Compara la forma compacta (solo letras y numeros, en mayusculas) de lo guardado,
// asi un codigo cargado como "7 791234 567890" coincide con la lectura "7791234567890".
const compactBarcode = Prisma.sql`upper(regexp_replace(coalesce("barcode", ''), '[^[:alnum:]]', '', 'g'))`;
const compactSku = Prisma.sql`upper(regexp_replace("sku", '[^[:alnum:]]', '', 'g'))`;
const similarCodeLimit = 5;
const minimumSimilarLength = 6;

/** Un codigo identifica un producto sin modificar stock; si coincide con mas de uno, no adivina. */
export async function resolveInventoryCode(
  prisma: Pick<PrismaClient, "$queryRaw">,
  raw: unknown,
): Promise<InventoryCodeResolution | null> {
  const code = normalizeScannedCode(raw);
  const candidates = code ? inventoryCodeCandidates(code) : [];
  if (!code || candidates.length === 0) return null;
  const products = await prisma.$queryRaw<InventoryCodeMatch[]>`
    SELECT "id", "sku", "barcode", "name", "location" FROM "ShopProduct"
    WHERE ${compactBarcode} = ANY(${candidates}) OR ${compactSku} = ANY(${candidates})
    ORDER BY "name" ASC`;
  if (products.length === 1) return { status: "found", product: products[0] };
  if (products.length > 1) return { status: "ambiguous", code, products };
  return { status: "unknown", code };
}

/**
 * Codigos guardados que casi coinciden con el leido: uno contiene al otro sin su primer
 * ni ultimo caracter (digito verificador o cero inicial de mas o de menos). Sirven para
 * detectar una ficha cargada con un error de tipeo; nunca se abren automaticamente.
 */
export async function findSimilarInventoryCodes(
  prisma: Pick<PrismaClient, "$queryRaw">,
  code: string,
): Promise<InventoryCodeMatch[]> {
  const compact = compactInventoryCode(code);
  if (compact.length < minimumSimilarLength + 2) return [];
  const core = compact.slice(1, -1);
  return prisma.$queryRaw<InventoryCodeMatch[]>`
    SELECT "id", "sku", "barcode", "name", "location" FROM "ShopProduct"
    WHERE "barcode" IS NOT NULL
      AND length(${compactBarcode}) >= ${minimumSimilarLength}
      AND (strpos(${compactBarcode}, ${core}) > 0 OR strpos(${compact}, ${compactBarcode}) > 0)
    ORDER BY "name" ASC
    LIMIT ${similarCodeLimit}`;
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
  const existing = await resolveInventoryCode(prisma, parsed.barcode);
  if (existing?.status === "found") throw new InventoryError(`El código ${parsed.barcode} ya identifica a "${existing.product.name}".`);
  if (existing?.status === "ambiguous") throw new InventoryError(`El código ${parsed.barcode} ya identifica a otros repuestos.`);

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
