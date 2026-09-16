# E1 — contrato entre agentes

Estado: implementar únicamente inventario interno. No tocar pagos, cuentas de clientes ni publicar. Mantener paleta/componentes existentes. No modificar archivos ajenos asignados.

## Esquema (coordinador)

Prisma `ShopProduct`: id, sku único, barcode opcional único, name, description?, category, brand?, compatibility?, location?, priceCents entero, stock entero, reservedStock entero, minimumStock entero, isActive boolean, version entero, createdAt/updatedAt.

`InventoryMovement`: id, productId, kind INITIAL/RECEIPT/ADJUSTMENT/REPAIR, quantityDelta, stockBefore/stockAfter, reason, reference?, actorId? relacionado a User, requestKey UUID único, requestFingerprint SHA256, createdAt. Stock disponible = stock - reservedStock. No se borran movimientos/productos.

## Servicio (agente inventory_service)

Archivos propios: `src/modules/shop/inventory-schemas.ts`, `src/modules/shop/inventory-service.ts`, `src/modules/shop/inventory-types.ts` si hace falta, y `tests/inventory-service.test.ts`. No tocar schema/migrations/UI.

Exports de `inventory-service.ts`:

- `createInventoryProduct(prisma: PrismaClient, input: unknown, actorId: string): Promise<ShopProduct>`
- `updateInventoryProduct(prisma: PrismaClient, input: unknown): Promise<ShopProduct>`
- `recordInventoryMovement(prisma: PrismaClient, input: unknown, actorId: string): Promise<ShopProduct>`
- `InventoryError extends Error` con mensaje español apto para mostrar; validación puede emitir ZodError.

create input: `{sku, barcode, name, description, category, brand, compatibility, location, priceArs, initialStock, minimumStock, isActive, requestKey}`. Strings vacíos opcionales se normalizan a null. Números pueden llegar como strings de FormData; `isActive` boolean real. Precio pesos decimal punto/coma, sin miles, hasta 2 decimales; requerido >=0.01 y <=1.000.000 ARS. Cantidades 0..1.000.000 enteros. Texto con límites. requestKey UUID. SKU trim uppercase, barcode texto preservando ceros.

update input: mismos campos de ficha, `id` y `version`; excluye initialStock/requestKey. Edición optimista por version, sin modificar stock/reservas.

movement input: `{productId, kind: RECEIPT|ADJUSTMENT|REPAIR, quantity, reason, reference, version, requestKey}`. RECEIPT suma quantity>0; REPAIR resta quantity>0; ADJUSTMENT establece físico a quantity>=0. Verificar versión y físico>=reservado. Motivo obligatorio. Confirmación transaccional. Actualiza versión. Toda creación registra INITIAL incluso con cero stock.

Validar dentro del servicio; idempotencia por requestKey+huella del contenido/actor, devolver resultado existente en reintento antes de comprobar versión, rechazar clave reutilizada con otro contenido. Condiciones atómicas + constraints DB. Orden Prisma transacción/errores de unicidad manejado con cuidado: fallos no dejan movimiento ni stock parcial.

## UI (agente inventory_ui)

Propios: `app/(internal)/internal/shop/**`, `src/modules/shop/*screen.tsx` y componentes de esa pantalla. Acciones autentican `auth/isInternalSession/getInternalSessionUserId`; consultas server-only directas Prisma permitidas. No tocar service/schema/nav global (coordinador conecta navegación).

Rutas `/internal/shop` resumen inventario real; `/internal/shop/inventory` buscador/filtros/listado y alta; `/internal/shop/inventory/[id]` ficha editable, movimiento e historial paginado/limitado explicitado. Formularios con feedback y pending/disabled, retener valores ante error preferentemente `useActionState`. Sin next/image remotas ni fotos en esta entrega. Todos los estados vacíos reales, sin demos. Mostrar stock físico/reservado/disponible, ubicación, mínimo y activo/inactivo. Esconder funciones de etapas futuras.

## Pruebas independientes (agente inventory_tests)

Propios: `tests/inventory-prisma.test.ts` y `e2e/inventory.spec.ts`. Usar interfaces de arriba y Prisma. No ejecutar migraciones ni crear usuarios en bases remotas. Pruebas nuevas deben verificar guard de destino local/allowlisted de test-data-guard. Casos: crear/editar, entrada/consumo/ajuste, auditoría, precio/código, stock reservado, concurrencia, rollback/idempotencia, acceso UI no autenticado y recorrido del personal. Prefijos únicos, limpieza sólo de sus fixtures. No cambiar otros tests.
