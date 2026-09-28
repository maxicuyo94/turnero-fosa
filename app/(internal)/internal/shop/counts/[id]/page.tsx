import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/src/lib/staff-access";
import { inventory, stockCounts } from "@/src/lib/composition";
import { StockCountScreen, type StockCountRow } from "@/src/modules/shop/stock-count-screen";
import { stockCountLineIssue } from "@/src/modules/shop/stock-count-service";

type Search = { code?: string; view?: string; notice?: string; error?: string };

export default async function StockCountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Search> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const raw = (await searchParams) ?? {};
  const count = await stockCounts.findStockCountDetail(id);
  if (!count) notFound();

  const movements = await stockCounts.movementCounts(count.lines.map((line) => line.product.id));
  const rows: StockCountRow[] = count.lines.map(({ expectedMovements, ...line }) => ({
    ...line,
    issue: count.status === "OPEN" ? stockCountLineIssue({ ...line, expectedMovements, product: { ...line.product, movements: movements.get(line.product.id) ?? 0 } }) : null,
  }));

  // Un codigo leido abre la carga de ese repuesto, este o no en el alcance del conteo.
  let focus: StockCountRow | undefined;
  let codeError: string | undefined;
  const resolution = count.status === "OPEN" && raw.code ? await inventory.resolveInventoryCode(raw.code) : null;
  if (resolution?.status === "found") {
    focus = rows.find((row) => row.product.id === resolution.product.id);
    if (!focus) {
      const product = await stockCounts.findStockCountProduct(resolution.product.id);
      focus = { product, expectedStock: product.stock, countedQuantity: null, issue: null };
    }
  } else if (resolution?.status === "ambiguous") {
    codeError = `El código ${resolution.code} coincide con varios repuestos. Buscalo en la lista.`;
  } else if (resolution?.status === "unknown") {
    codeError = `El código ${resolution.code} no está registrado.`;
  }

  const person = (user: { name: string | null; username: string | null } | null) => user?.name ?? user?.username ?? null;
  return (
    <StockCountScreen
      canManageWorkshop={hasRole(staff, "ADMIN")}
      count={{ ...count, openedBy: person(count.openedBy), closedBy: person(count.closedBy) }}
      error={(raw.error ?? codeError)?.slice(0, 300)}
      focus={focus}
      inScope={focus ? rows.includes(focus) : true}
      notice={raw.notice?.slice(0, 300)}
      rows={rows}
      signedInUserName={staff.displayName}
      view={["pending", "diff", "review"].includes(raw.view ?? "") ? raw.view as "pending" | "diff" | "review" : "all"}
    />
  );
}
