import type { PrismaClient } from "@prisma/client";
import { catalogDetailsSchema } from "./catalog-schemas";
import { ShopOrderError } from "./order-service";

export async function saveCatalogDetails(prisma: PrismaClient, raw: unknown) {
  const input = catalogDetailsSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.shopProduct.updateMany({ where: { id: input.id, version: input.version }, data: { version: { increment: 1 } } });
    if (updated.count !== 1) throw new ShopOrderError("La ficha cambió. Recargala antes de guardar las fotos y compatibilidades.");
    await tx.shopProductImage.deleteMany({ where: { productId: input.id } });
    if (input.images.length) await tx.shopProductImage.createMany({ data: input.images.map((image, position) => ({ ...image, position, productId: input.id })) });
    await tx.shopProductFitment.deleteMany({ where: { productId: input.id } });
    for (const { brand, model, variant, yearFrom, yearTo } of input.fitments) {
      const vehicle = await tx.shopVehicleModel.upsert({ where: { brand_model_variant: { brand, model, variant } }, create: { brand, model, variant }, update: {} });
      await tx.shopProductFitment.create({ data: { productId: input.id, vehicleModelId: vehicle.id, yearFrom, yearTo } });
    }
  });
}
