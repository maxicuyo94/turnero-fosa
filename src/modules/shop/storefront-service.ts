import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { shopSettingsSchema } from "./storefront-schemas";
import { ShopOrderError } from "./order-service";

export async function saveShopConfiguration(prisma: PrismaClient, raw: unknown) {
  const { shippingFeeArs, ...config } = shopSettingsSchema.parse(raw);
  return prisma.shopSettings.upsert({ where: { id: "shop" }, create: { id: "shop", ...config, shippingFeeCents: shippingFeeArs }, update: { ...config, shippingFeeCents: shippingFeeArs } });
}

export async function publishShopProduct(prisma: PrismaClient, raw: unknown) {
  const input = z.object({ id: z.string().min(1).max(128), version: z.coerce.number().int().min(0), isPublished: z.boolean() }).parse(raw);
  const result = await prisma.shopProduct.updateMany({ where: { id: input.id, version: input.version }, data: { isPublished: input.isPublished, version: { increment: 1 } } });
  if (result.count !== 1) throw new ShopOrderError("La ficha cambió. Recargala antes de publicar.");
}
