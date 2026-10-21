import type { PrismaClient } from "@prisma/client";
import { hashShopToken } from "./order-service";
import { decryptOrderContact } from "./order-privacy";

export async function shopConfiguration(prisma: PrismaClient) {
  return await prisma.shopSettings.findUnique({ where: { id: "shop" } }) ?? {
    id: "shop", checkoutEnabled: false, shippingEnabled: false, shippingFeeCents: 0,
    shippingPostalCodes: [] as string[], pickupInstructions: "",
  };
}

export async function publicCatalog(prisma: PrismaClient) {
  const products = await prisma.shopProduct.findMany({
    where: { isActive: true, isPublished: true }, orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, category: true, brand: true, description: true,
      compatibility: true, priceCents: true, stock: true, reservedStock: true,
      images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
      fitments: { select: { yearFrom: true, yearTo: true, vehicleModel: { select: { id: true, brand: true, model: true, variant: true } } } } },
    take: 1000,
  });
  // Never expose storage locations, barcodes, inventory costs or movement history publicly.
  return products.map(({ stock, reservedStock, ...product }) => ({ ...product, available: Math.max(0, stock - reservedStock) }));
}

export async function publicProduct(prisma: PrismaClient, id: string) {
  const product = await prisma.shopProduct.findFirst({ where: { id, isActive: true, isPublished: true },
    select: { id: true, sku: true, name: true, category: true, brand: true, description: true, compatibility: true,
      priceCents: true, stock: true, reservedStock: true,
      images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
      fitments: { select: { yearFrom: true, yearTo: true, vehicleModel: { select: { id: true, brand: true, model: true, variant: true } } } } } });
  if (!product) return null;
  const { stock, reservedStock, ...details } = product;
  return { ...details, available: Math.max(0, stock - reservedStock) };
}

export function publicOrder(prisma: PrismaClient, token: string) {
  if (!/^[a-f0-9]{64}$/u.test(token)) return Promise.resolve(null);
  return prisma.shopOrder.findUnique({ where: { accessTokenHash: hashShopToken(token) },
    select: { id: true, code: true, status: true, deliveryKind: true, subtotalCents: true, shippingFeeCents: true,
      totalCents: true, expiresAt: true, tracking: true, createdAt: true,
      items: { select: { productId: true, name: true, quantity: true, unitPriceCents: true } } },
  });
}

export async function internalOrders(prisma: PrismaClient) {
  const orders = await prisma.shopOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100,
    omit: { accessTokenHash: true, fingerprint: true, requestKey: true },
    include: { items: true, payments: true, events: { orderBy: { createdAt: "desc" } } } });
  return orders.map(decryptOrderContact);
}
