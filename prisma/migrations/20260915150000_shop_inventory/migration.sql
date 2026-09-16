-- Independent inventory tables: existing appointments and settings are unchanged.
CREATE TYPE "InventoryMovementKind" AS ENUM ('INITIAL', 'RECEIPT', 'ADJUSTMENT', 'REPAIR');

CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "compatibility" TEXT,
    "location" TEXT,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShopProduct_stock_valid" CHECK ("stock" BETWEEN 0 AND 1000000 AND "reservedStock" BETWEEN 0 AND "stock"),
    CONSTRAINT "ShopProduct_price_valid" CHECK ("priceCents" BETWEEN 1 AND 100000000),
    CONSTRAINT "ShopProduct_minimum_valid" CHECK ("minimumStock" BETWEEN 0 AND 1000000),
    CONSTRAINT "ShopProduct_version_valid" CHECK ("version" >= 0)
);

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "InventoryMovementKind" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "actorId" TEXT,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryMovement_stock_valid" CHECK ("stockBefore" BETWEEN 0 AND 1000000 AND "stockAfter" BETWEEN 0 AND 1000000),
    CONSTRAINT "InventoryMovement_delta_valid" CHECK ("stockAfter" - "stockBefore" = "quantityDelta")
);

CREATE UNIQUE INDEX "ShopProduct_sku_key" ON "ShopProduct"("sku");
CREATE UNIQUE INDEX "ShopProduct_barcode_key" ON "ShopProduct"("barcode");
CREATE INDEX "ShopProduct_isActive_name_idx" ON "ShopProduct"("isActive", "name");
CREATE INDEX "ShopProduct_category_idx" ON "ShopProduct"("category");
CREATE UNIQUE INDEX "InventoryMovement_requestKey_key" ON "InventoryMovement"("requestKey");
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
