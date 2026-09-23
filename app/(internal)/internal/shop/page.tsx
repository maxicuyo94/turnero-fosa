import { requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { ShopDashboardScreen, type InventoryListProduct } from "@/src/modules/shop/inventory-screen";

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

/** Internal inventory home. It intentionally contains no sales metrics until point-of-sale exists. */
export default async function ShopPage() {
  const staff = await requireStaff();

  const [totalProducts, activeProducts, stock, lowStockRows, recentProducts] = await Promise.all([
    db.shopProduct.count(),
    db.shopProduct.count({ where: { isActive: true } }),
    db.shopProduct.aggregate({ _sum: { stock: true, reservedStock: true } }),
    db.shopProduct.findMany({ select: { stock: true, reservedStock: true, minimumStock: true } }),
    db.shopProduct.findMany({ orderBy: { createdAt: "desc" }, select: productSelect, take: 6 }),
  ]);

  const lowStockProducts = lowStockRows.filter((product) => product.stock - product.reservedStock <= product.minimumStock).length;
  return <ShopDashboardScreen activeProducts={activeProducts} availableStockUnits={(stock._sum.stock ?? 0) - (stock._sum.reservedStock ?? 0)} lowStockProducts={lowStockProducts} recentProducts={recentProducts as InventoryListProduct[]} signedInUserName={staff.displayName} stockUnits={stock._sum.stock ?? 0} totalProducts={totalProducts} />;
}
