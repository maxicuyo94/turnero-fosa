import Link from "next/link";
import { Card, PageHeading, PageShell, SiteHeader } from "@/src/components/ui";
export default function ShopNotFound() {
  return <><SiteHeader active="shop" linkComponent={Link} /><PageShell><PageHeading eyebrow="Tienda de repuestos" title="Este repuesto no está disponible." description="Puede haber dejado de publicarse. Podés buscar otra pieza o consultar al taller." /><Card className="mt-6"><Link href="/shop" className="inline-flex min-h-11 items-center font-bold text-action">Volver al catálogo →</Link></Card></PageShell></>;
}
