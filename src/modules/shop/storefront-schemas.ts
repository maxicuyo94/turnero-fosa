import { z } from "zod";
import { deliveryPostalCode, isLocalDelivery } from "./shipping-policy";

const text = (max: number) => z.string().trim().min(1, "Completá este campo.").max(max);
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
export const cartSchema = z.array(z.object({
  productId: text(128), quantity: z.number().int().min(1).max(100),
  unitPriceCents: z.number().int().min(1).max(100_000_000),
}).strict()).min(1, "Agregá un repuesto al carrito.").max(50).refine(
  (items) => new Set(items.map((item) => item.productId)).size === items.length,
  "El carrito tiene productos repetidos.",
);
export const checkoutSchema = z.object({
  requestKey: z.string().uuid(), accessToken: z.string().regex(/^[a-f0-9]{64}$/u),
  buyerKind: z.enum(["INDIVIDUAL", "MECHANIC"]),
  fullName: text(120), email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  phone: text(40).refine((v) => /^[+\d ()-]+$/u.test(v) && v.replace(/\D/gu, "").length >= 6 && v.replace(/\D/gu, "").length <= 20, "Ingresá un teléfono válido."),
  workshopName: optional(120), deliveryKind: z.enum(["PICKUP", "SHIPPING"]),
  address: optional(250), city: optional(100), province: optional(100), postalCode: optional(8),
  items: cartSchema,
  shippingFeeCents: z.number().int().min(0).max(100_000_000),
}).strict().superRefine((input, ctx) => {
  if (input.deliveryKind === "SHIPPING") {
    for (const field of ["address", "city", "province", "postalCode"] as const) {
      if (!input[field]) ctx.addIssue({ code: "custom", path: [field], message: "Completá los datos de envío." });
    }
    if (input.postalCode && !/^\d{4}$/u.test(input.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Ingresá el código postal de cuatro números." });
    if (input.city && input.province && input.postalCode && !isLocalDelivery(input.city, input.province, input.postalCode)) ctx.addIssue({ code: "custom", path: ["city"], message: "Todavía no enviamos fuera de Salta capital. Podés elegir retiro en el taller." });
  }
});
export const shopSettingsSchema = z.object({
  checkoutEnabled: z.boolean(), shippingEnabled: z.boolean(),
  shippingFeeArs: z.string().trim().regex(/^\d{1,6}([.,]\d{1,2})?$/u, "Ingresá el costo de envío con hasta dos decimales.").transform((v) => Math.round(Number(v.replace(",", ".")) * 100)),
  shippingPostalCodes: z.string().max(5000).transform((v) => [...new Set(v.split(/[\s,;]+/u).filter(Boolean))])
    .refine((v) => v.every((cp) => /^\d{4}$/u.test(cp)), "Usá códigos postales de cuatro números separados por coma."),
  pickupInstructions: z.string().trim().max(1000),
}).superRefine((v, ctx) => {
  if (v.shippingEnabled && !v.shippingPostalCodes.length) ctx.addIssue({ code: "custom", path: ["shippingPostalCodes"], message: "Definí la cobertura antes de habilitar envíos." });
  if (v.shippingPostalCodes.some((code) => code !== deliveryPostalCode)) ctx.addIssue({ code: "custom", path: ["shippingPostalCodes"], message: "Por el momento solo se pueden habilitar envíos en Salta capital (CP 4400)." });
  if (v.checkoutEnabled && !v.pickupInstructions) ctx.addIssue({ code: "custom", path: ["pickupInstructions"], message: "Indicá la dirección y los horarios para retirar." });
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ShopActionResult = { error?: string; success?: string; orderUrl?: string };
export const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);
export const orderStatusLabels = {
  AWAITING_PAYMENT: "Esperando pago", PAID: "Pago acreditado", READY: "Listo para retirar",
  SHIPPED: "Enviado", COMPLETED: "Entregado", CANCELLED: "Cancelado", EXPIRED: "Pago vencido",
  PAYMENT_REVIEW: "Pago en revisión por el taller",
} as const;
