import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { normalizeScannedCode } from "@/src/modules/shop/inventory-code";
import { InventoryScreen, type InventoryListProduct } from "@/src/modules/shop/inventory-screen";

const productSelect = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  category: true,
  brand: true,
  location: true,
  priceCents: true,
  stock: true,
  reservedStock: true,
  minimumStock: true,
  isActive: true,
} as const;

type Search = { q?: string; status?: string; category?: string; location?: string; barcode?: string };

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const staff = await requireStaff();

  const raw = await searchParams;
  const filters = {
    q: clean(raw?.q, 120),
    status: ["active", "inactive", "low"].includes(raw?.status ?? "") ? raw?.status ?? "" : "",
    category: clean(raw?.category, 80),
    location: clean(raw?.location, 120),
  };
  const where: Prisma.ShopProductWhereInput = {
    ...(filters.status === "active" ? { isActive: true } : filters.status === "inactive" ? { isActive: false } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.location ? { location: filters.location } : {}),
    ...(filters.q ? { OR: [
      { name: { contains: filters.q, mode: "insensitive" } },
      { sku: { contains: filters.q, mode: "insensitive" } },
      { barcode: { contains: filters.q, mode: "insensitive" } },
      { brand: { contains: filters.q, mode: "insensitive" } },
      { compatibility: { contains: filters.q, mode: "insensitive" } },
      { location: { contains: filters.q, mode: "insensitive" } },
    ] } : {}),
  };
  const [rows, categoryRows, locationRows] = await Promise.all([
    db.shopProduct.findMany({ where, select: productSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.shopProduct.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    db.shopProduct.findMany({ where: { location: { not: null } }, distinct: ["location"], orderBy: { location: "asc" }, select: { location: true } }),
  ]);
  const products = filters.status === "low"
    ? rows.filter((product) => product.stock - product.reservedStock <= product.minimumStock)
    : rows;
  return <InventoryScreen categories={categoryRows.map((row) => row.category)} createRequestKey={randomUUID()} filters={filters} initialBarcode={normalizeScannedCode(raw?.barcode) ?? undefined} locations={locationRows.flatMap((row) => row.location ? [row.location] : [])} products={products as InventoryListProduct[]} signedInUserName={staff.displayName} />;
}

function clean(value: string | undefined, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
