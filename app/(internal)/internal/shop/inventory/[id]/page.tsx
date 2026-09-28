import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { inventory } from "@/src/lib/composition";
import { InventoryProductScreen, type InventoryDetailProduct, type InventoryHistoryItem } from "@/src/modules/shop/inventory-screen";

const historyLimit = 50;

export default async function InventoryProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ linked?: string }> }) {
  const staff = await requireStaff();

  const { id } = await params;
  const linked = (await searchParams)?.linked === "1";
  const product = await inventory.findInventoryProductDetail(id, historyLimit);
  if (!product) notFound();
  const { movements, ...detail } = product;
  return <InventoryProductScreen history={movements as InventoryHistoryItem[]} historyLimit={historyLimit} movementRequestKey={randomUUID()} notice={linked ? "Código vinculado. La próxima lectura abre esta ficha." : undefined} product={detail as InventoryDetailProduct} canManageWorkshop={hasRole(staff, "ADMIN")} signedInUserName={staff.displayName} />;
}
