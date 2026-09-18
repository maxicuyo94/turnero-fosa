import { z } from "zod";

const MAX_QUANTITY = 1_000_000;
const MAX_PRICE_ARS = 1_000_000;

function requiredText(max: number) {
  return z.string().trim().min(1, "Este campo es obligatorio.").max(max, `No puede superar ${max} caracteres.`);
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `No puede superar ${max} caracteres.`).nullish()
    .transform((value) => value || null);

const integerInput = z.union([
  z.number(),
  z.string().trim().regex(/^\d+$/u, "Ingresá una cantidad entera, sin signos ni decimales."),
]).transform(Number);

const quantitySchema = integerInput.pipe(z.number()
  .int("Ingresá una cantidad entera.")
  .min(0, "La cantidad no puede ser negativa.")
  .max(MAX_QUANTITY, "La cantidad no puede superar 1.000.000 de unidades."));

const versionSchema = integerInput.pipe(z.number().int("La versión no es válida.")
  .min(0, "Recargá la ficha e intentá nuevamente.")
  .max(2_147_483_647, "Recargá la ficha e intentá nuevamente."));

const priceArsSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw = typeof value === "number" ? String(value) : value.trim();
    const matched = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(raw);
    if (!matched) {
      ctx.addIssue({ code: "custom", message: "Ingresá un precio sin separadores de miles y con hasta dos decimales." });
      return z.NEVER;
    }

    const cents = Number(matched[1]) * 100 + Number((matched[2] ?? "").padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_PRICE_ARS * 100) {
      ctx.addIssue({ code: "custom", message: "El precio debe estar entre $0,01 y $1.000.000." });
      return z.NEVER;
    }
    return cents;
  });

const productFields = z.object({
  sku: requiredText(80).transform((value) => value.toUpperCase()),
  barcode: optionalText(128),
  name: requiredText(160),
  description: optionalText(2_000),
  category: requiredText(80),
  brand: optionalText(80),
  compatibility: optionalText(500),
  location: optionalText(120),
  priceArs: priceArsSchema,
  minimumStock: quantitySchema,
  isActive: z.boolean({ error: "El estado activo debe ser verdadero o falso." }),
});

export const createInventoryProductSchema = productFields.extend({
  sku: optionalText(80).transform((value) => value?.toUpperCase() ?? null),
  initialStock: quantitySchema,
  requestKey: z.string().uuid("La clave de la operación no es válida."),
}).transform((input) => ({
  ...input,
  sku: input.sku ?? `REP-${input.requestKey.replaceAll("-", "").toUpperCase()}`,
}));

export const updateInventoryProductSchema = productFields.extend({
  id: requiredText(128),
  version: versionSchema,
});

export const inventoryMovementKindSchema = z.enum(["RECEIPT", "ADJUSTMENT", "REPAIR"]);

export const recordInventoryMovementSchema = z.object({
  productId: requiredText(128),
  kind: inventoryMovementKindSchema,
  quantity: quantitySchema,
  reason: requiredText(500),
  reference: optionalText(160),
  version: versionSchema,
  requestKey: z.string().uuid("La clave de la operación no es válida."),
}).superRefine((input, ctx) => {
  if ((input.kind === "RECEIPT" || input.kind === "REPAIR") && input.quantity === 0) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "La cantidad debe ser mayor que cero." });
  }
});

export type CreateInventoryProductInput = z.infer<typeof createInventoryProductSchema>;
export type UpdateInventoryProductInput = z.infer<typeof updateInventoryProductSchema>;
export type RecordInventoryMovementInput = z.infer<typeof recordInventoryMovementSchema>;
