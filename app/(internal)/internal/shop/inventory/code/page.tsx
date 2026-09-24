import { redirect } from "next/navigation";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { findSimilarInventoryCodes, resolveInventoryCode } from "@/src/modules/shop/inventory-code-service";
import { InventoryCodeScreen } from "@/src/modules/shop/inventory-screen";

type Search = { value?: string | string[]; q?: string | string[]; error?: string | string[] };

const linkCandidateLimit = 20;

export default async function InventoryCodePage({ searchParams }: { searchParams?: Promise<Search> }) {
  const staff = await requireStaff();

  const raw = (await searchParams) ?? {};
  const resolution = await resolveInventoryCode(db, first(raw.value));
  if (!resolution) redirect("/internal/shop/inventory");
  if (resolution.status === "found") redirect(`/internal/shop/inventory/${resolution.product.id}`);

  const linkQuery = (first(raw.q) ?? "").trim().slice(0, 120);
  const similar = resolution.status === "unknown" ? await findSimilarInventoryCodes(db, resolution.code) : [];
  const linkCandidates = resolution.status === "unknown"
    ? await db.shopProduct.findMany({
        where: {
          barcode: null,
          ...(linkQuery ? { OR: [
            { name: { contains: linkQuery, mode: "insensitive" } },
            { sku: { contains: linkQuery, mode: "insensitive" } },
            { brand: { contains: linkQuery, mode: "insensitive" } },
          ] } : {}),
        },
        select: { id: true, sku: true, barcode: true, name: true, location: true, version: true },
        orderBy: { updatedAt: "desc" },
        take: linkCandidateLimit,
      })
    : [];

  return (
    <InventoryCodeScreen
      code={resolution.code}
      error={first(raw.error)?.slice(0, 300)}
      linkCandidates={linkCandidates}
      linkQuery={linkQuery}
      matches={resolution.status === "ambiguous" ? resolution.products : []}
      similar={similar}
      canManageWorkshop={hasRole(staff, "ADMIN")}
      signedInUserName={staff.displayName}
    />
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
