import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "../src/lib/prisma-adapter";
import { resolveTestDataTarget } from "../src/modules/testing/test-data-guard";
import { createInventoryProduct } from "../src/modules/shop/inventory-service";
import { publishShopProduct } from "../src/modules/shop/storefront-service";
import { saveCatalogDetails } from "../src/modules/shop/catalog-service";

const products = [
  { code: "FILTRO-ACEITE", name: "Filtro de aceite", category: "Filtros", brand: "MotoPro", priceArs: "6500", initialStock: 12, compatibility: "Motos de 125 a 150 cc", description: "Filtro de recambio para mantenimiento periódico." },
  { code: "FILTRO-AIRE", name: "Filtro de aire", category: "Filtros", brand: "MotoPro", priceArs: "8900", initialStock: 8, compatibility: "Motos urbanas de 150 cc", description: "Elemento filtrante para admisión." },
  { code: "PASTILLAS", name: "Pastillas de freno delanteras", category: "Frenos", brand: "Ruta", priceArs: "18500", initialStock: 6, compatibility: "Freno delantero a disco", description: "Juego de dos pastillas para freno a disco." },
  { code: "ZAPATAS", name: "Zapatas de freno traseras", category: "Frenos", brand: "Ruta", priceArs: "14200", initialStock: 4, compatibility: "Freno trasero a tambor", description: "Juego de zapatas con resortes." },
  { code: "BUJIA", name: "Bujía estándar", category: "Encendido", brand: "Chispa", priceArs: "5200", initialStock: 20, compatibility: "Motores de cuatro tiempos", description: "Bujía de recambio para el sistema de encendido." },
  { code: "BOBINA", name: "Bobina de encendido", category: "Encendido", brand: "Chispa", priceArs: "22900", initialStock: 0, compatibility: "Sistema de encendido de 12 V", description: "Ejemplo de producto agotado para probar disponibilidad." },
  { code: "KIT-TRANSMISION", name: "Kit de transmisión completo", category: "Transmisión", brand: "Ruta", priceArs: "48500", initialStock: 5, compatibility: "Motos urbanas de 150 cc", description: "Conjunto de cadena, piñón y corona." },
  { code: "CADENA", name: "Cadena de transmisión 428", category: "Transmisión", brand: "Ruta", priceArs: "26900", initialStock: 1, compatibility: "Transmisión de paso 428", description: "Una sola unidad para probar el límite de stock del carrito." },
  { code: "ACEITE", name: "Aceite para moto 10W-40 · 1 litro", category: "Lubricantes", brand: "MotoPro", priceArs: "15900", initialStock: 18, compatibility: "Motos de cuatro tiempos", description: "Envase de un litro para mantenimiento." },
  { code: "LUBRICANTE", name: "Lubricante de cadena · 400 ml", category: "Lubricantes", brand: "MotoPro", priceArs: "12800", initialStock: 10, compatibility: "Cadenas de transmisión", description: "Aerosol para mantenimiento de cadena." },
  { code: "BATERIA", name: "Batería de moto 12 V · 5 Ah", category: "Eléctrico", brand: "Volt", priceArs: "62900", initialStock: 3, compatibility: "Sistema eléctrico de 12 V", description: "Batería de recambio para moto." },
  { code: "LAMPARA", name: "Lámpara de faro 12 V", category: "Eléctrico", brand: "Volt", priceArs: "7200", initialStock: 0, compatibility: "Faro delantero de 12 V", description: "Segundo ejemplo de producto agotado." },
];

function requestKey(sku: string) {
  const hex = createHash("sha256").update(`shop-demo-v1:${sku}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function main() {
  const target = resolveTestDataTarget({ profile: "development" });
  if (!target.allowed) throw new Error(`[shop-demo] ${target.message}`);
  // This sample storefront is for this local workspace, even if another test host is allowlisted.
  if (!["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(target.host)) throw new Error("Los ejemplos de tienda se cargan únicamente en una base local.");
  const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const actor = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!actor) throw new Error("Primero configurá el usuario administrador local del taller.");
    let created = 0;
    for (const [index, sample] of products.entries()) {
      const { code, description, ...fields } = sample;
      const sku = `DEMO-SHOP-${code}`;
      // Preserve edits, reservations, sales and stock changes when running the loader again.
      if (await prisma.shopProduct.findUnique({ where: { sku }, select: { id: true } })) continue;
      const product = await createInventoryProduct(prisma, { ...fields, sku, brand: `${fields.brand} (demo)`,
        description: `Producto de ejemplo. Precio, marca y compatibilidad ficticios para probar la tienda. ${description}`,
        barcode: null, location: `DEMO · Estante ${Math.floor(index / 4) + 1}`, minimumStock: 2,
        isActive: true, requestKey: requestKey(sku),
      }, actor.id);
      await publishShopProduct(prisma, { id: product.id, version: product.version, isPublished: true });
      created++;
    }
    await prisma.shopSettings.upsert({ where: { id: "shop" }, update: {}, create: {
      id: "shop", checkoutEnabled: false, shippingEnabled: true, shippingFeeCents: 250000,
      shippingPostalCodes: ["4400"], pickupInstructions: "Retiro de ejemplo · Calle de Prueba 123 · Lunes a viernes de 9 a 18 h. Datos ficticios para probar la tienda.",
    } });
    // Fictional model identities make the new filter testable without claiming real fitment.
    let enriched = 0;
    for (const code of ["FILTRO-ACEITE", "FILTRO-AIRE", "PASTILLAS", "BUJIA", "KIT-TRANSMISION", "CADENA"]) {
      const product = await prisma.shopProduct.findUnique({ where: { sku: `DEMO-SHOP-${code}` }, include: { images: { orderBy: { position: "asc" } }, fitments: true } });
      if (!product || !product.brand?.endsWith("(demo)") || !product.description?.startsWith("Producto de ejemplo.") || product.fitments.length) continue;
      await saveCatalogDetails(prisma, { id: product.id, version: product.version, images: product.images.map(({ url, alt }) => ({ url, alt })),
        fitments: [{ brand: "DEMO", model: "URBANA DE PRUEBA", variant: "150", yearFrom: "2020", yearTo: "2026" },
          ...(code === "BUJIA" ? [{ brand: "DEMO", model: "URBANA DE PRUEBA", variant: "110", yearFrom: "2018", yearTo: "2024" }] : [])] });
      enriched++;
    }
    const total = await prisma.shopProduct.count({ where: { sku: { startsWith: "DEMO-SHOP-" } } });
    console.log(`[shop-demo] ${created} repuestos creados; ${total} ejemplos en ${target.host}/${target.database}; ${enriched} fichas con modelos ficticios. Stock inicial auditado. Compras online sin activar.`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudieron cargar los ejemplos.");
  process.exitCode = 1;
});
