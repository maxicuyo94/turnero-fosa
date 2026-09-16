import { randomUUID } from "crypto";
import { notFound, redirect } from "next/navigation";
import { auth, getInternalSessionDisplayName, isInternalSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { InventoryProductScreen, type InventoryDetailProduct, type InventoryHistoryItem } from "@/src/modules/shop/inventory-screen";

const historyLimit = 50;

export default async function InventoryProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalSession(session)) redirect("/internal/login");

  const { id } = await params;
  const product = await db.shopProduct.findUnique({
    where: { id },
    select: {
      id: true, sku: true, barcode: true, name: true, description: true, category: true, brand: true,
      compatibility: true, location: true, priceCents: true, stock: true, reservedStock: true,
      minimumStock: true, isActive: true, version: true, updatedAt: true,
      movements: {
        take: historyLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, kind: true, quantityDelta: true, stockBefore: true, stockAfter: true, reason: true,
          reference: true, createdAt: true,
          actor: { select: { name: true, username: true, email: true } },
        },
      },
    },
  });
  if (!product) notFound();
  const { movements, ...detail } = product;
  return <InventoryProductScreen history={movements as InventoryHistoryItem[]} historyLimit={historyLimit} movementRequestKey={randomUUID()} product={detail as InventoryDetailProduct} signedInUserName={getInternalSessionDisplayName(session)} />;
}
