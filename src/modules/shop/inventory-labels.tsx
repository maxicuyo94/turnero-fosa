import Link from "next/link";
import { EmptyState } from "@/src/components/ui";
import { labelCodeFor, type LabelCode } from "@/src/modules/shop/label-code";
import { PrintButton } from "@/src/modules/shop/print-button";

export type LabelProduct = { id: string; sku: string; name: string; location: string | null; priceCents: number };

export const MAX_LABEL_COPIES = 20;
export const MAX_LABEL_PRODUCTS = 300;

/**
 * Hoja de etiquetas internas: fondo blanco en pantalla y en papel, 60 x 30 mm, con el SKU
 * en Code 128 o QR para que el escaner del panel abra la ficha.
 */
export function InventoryLabelsScreen({ products, copies, backHref, truncated, copiesQuery }: { products: LabelProduct[]; copies: number; backHref: string; truncated: boolean; copiesQuery: string }) {
  const labels = products.flatMap((product) => Array.from({ length: copies }, (_, copy) => ({ product, key: `${product.id}-${copy}` })));
  const unreadable = products.filter((product) => !labelCodeFor(product.sku)).length;
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link className="text-sm font-bold text-zinc-400 hover:text-white" href={backHref}>← Volver a inventario</Link>
          <h1 className="mt-4 text-3xl font-black text-white">Etiquetas internas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{labels.length} {labels.length === 1 ? "etiqueta" : "etiquetas"} de 60 × 30 mm. El código es el SKU del taller, no el del fabricante: al escanearlo se abre la ficha. Los SKU largos salen en QR, que un lector USB de barras no lee.</p>
          {truncated ? <p className="mt-2 text-sm text-apple-300">Se muestran los primeros {MAX_LABEL_PRODUCTS} repuestos. Filtrá el listado para imprimir el resto.</p> : null}
          {unreadable ? <p className="mt-2 text-sm text-red-300">{unreadable} {unreadable === 1 ? "repuesto tiene" : "repuestos tienen"} un SKU con acentos o ñ: se imprime sin código. Cambiá el SKU en la ficha para poder escanearlo.</p> : null}
        </div>
        <form className="flex items-end gap-3" method="get">
          {[...new URLSearchParams(copiesQuery)].map(([name, value]) => <input key={`${name}-${value}`} name={name} type="hidden" value={value} />)}
          <label className="text-sm text-zinc-300">Copias por repuesto
            <input className="mt-1 block w-24 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" defaultValue={copies} max={MAX_LABEL_COPIES} min={1} name="copies" type="number" />
          </label>
          <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.08]" type="submit">Aplicar</button>
          <PrintButton disabled={!labels.length} />
        </form>
      </div>
      {labels.length ? (
        <ol aria-label="Etiquetas" className="mx-auto mt-8 flex max-w-5xl flex-wrap gap-2 print:mt-0 print:max-w-none print:gap-0">
          {labels.map(({ product, key }) => <InventoryLabel key={key} product={product} />)}
        </ol>
      ) : <EmptyState className="mx-auto mt-8 max-w-5xl print:hidden">No hay repuestos para etiquetar con esos filtros.</EmptyState>}
    </main>
  );
}

function InventoryLabel({ product }: { product: LabelProduct }) {
  const code = labelCodeFor(product.sku);
  const text = (
    <>
      <p className="line-clamp-2 text-[8pt] font-bold leading-tight">{product.name}</p>
      <p className="break-all font-mono text-[6.5pt] leading-tight">{product.sku}</p>
      {product.location ? <p className="truncate text-[6.5pt] leading-tight text-zinc-600">{product.location}</p> : null}
    </>
  );
  return (
    <li className="h-[30mm] w-[60mm] break-inside-avoid overflow-hidden rounded-sm bg-white px-[2.5mm] py-[1.5mm] text-black print:rounded-none print:outline print:outline-[0.1mm] print:outline-zinc-300">
      {code?.kind === "qr" ? (
        <div className="flex h-full items-center gap-[2mm]"><QrCode label={product.sku} modules={code.modules} /><div className="flex min-w-0 flex-col gap-[1mm]">{text}</div></div>
      ) : (
        <div className="flex h-full flex-col justify-between">{text}{code ? <Barcode label={product.sku} widths={code.widths} /> : <p className="text-[7pt] text-zinc-600">Sin código</p>}</div>
      )}
    </li>
  );
}

function Barcode({ label, widths }: { label: string; widths: Extract<LabelCode, { kind: "code128" }>["widths"] }) {
  const quiet = 10;
  const total = widths.reduce((sum, width) => sum + width, 0) + quiet * 2;
  // Posicion de cada elemento: la zona de silencio mas los anchos anteriores.
  const starts = widths.map((_, index) => quiet + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const bars = widths.flatMap((width, index) => index % 2 === 0 ? [<rect height="1" key={index} width={width} x={starts[index]} y="0" />] : []);
  return <svg aria-label={`Código de barras ${label}`} className="h-[11mm] w-full shrink-0" preserveAspectRatio="none" role="img" shapeRendering="crispEdges" viewBox={`0 0 ${total} 1`}>{bars}</svg>;
}

function QrCode({ label, modules }: { label: string; modules: boolean[][] }) {
  const quiet = 2;
  const size = modules.length + quiet * 2;
  const cells = modules.flatMap((row, y) => row.flatMap((dark, x) => dark ? [<rect height="1" key={`${x}-${y}`} width="1" x={x + quiet} y={y + quiet} />] : []));
  return <svg aria-label={`Código QR ${label}`} className="h-[25mm] w-[25mm] shrink-0" role="img" shapeRendering="crispEdges" viewBox={`0 0 ${size} ${size}`}>{cells}</svg>;
}
