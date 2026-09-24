import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { db } from "@/src/lib/db";
import { StockCountsScreen } from "@/src/modules/shop/stock-count-screen";

export default async function StockCountsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const staff = await requireStaff();
  const error = (await searchParams)?.error?.slice(0, 300);
  const [counts, locationRows] = await Promise.all([
    db.stockCount.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, title: true, location: true, status: true, createdAt: true, closedAt: true,
        openedBy: { select: { name: true, username: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.shopProduct.findMany({ where: { location: { not: null } }, distinct: ["location"], orderBy: { location: "asc" }, select: { location: true } }),
  ]);
  const countedRows = await db.stockCountLine.groupBy({ by: ["countId"], where: { countId: { in: counts.map((count) => count.id) }, countedQuantity: { not: null } }, _count: { _all: true } });
  const counted = new Map(countedRows.map((row) => [row.countId, row._count._all]));
  return (
    <StockCountsScreen
      canManageWorkshop={hasRole(staff, "ADMIN")}
      counts={counts.map(({ _count, openedBy, ...count }) => ({ ...count, lines: _count.lines, counted: counted.get(count.id) ?? 0, openedBy: openedBy?.name ?? openedBy?.username ?? null }))}
      error={error}
      locations={locationRows.flatMap((row) => row.location ? [row.location] : [])}
      signedInUserName={staff.displayName}
    />
  );
}
