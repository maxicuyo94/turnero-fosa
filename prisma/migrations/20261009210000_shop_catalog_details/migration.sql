CREATE TABLE "ShopProductImage" (
  "id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL, "url" TEXT NOT NULL,
  "alt" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ShopProductImage_position_check" CHECK ("position" >= 0),
  CONSTRAINT "ShopProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopProductImage_productId_position_key" ON "ShopProductImage"("productId", "position");
CREATE TABLE "ShopVehicleModel" (
  "id" TEXT PRIMARY KEY, "brand" TEXT NOT NULL, "model" TEXT NOT NULL, "variant" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "ShopVehicleModel_brand_model_variant_key" ON "ShopVehicleModel"("brand", "model", "variant");
CREATE TABLE "ShopProductFitment" (
  "id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL, "vehicleModelId" TEXT NOT NULL,
  "yearFrom" INTEGER, "yearTo" INTEGER,
  CONSTRAINT "ShopProductFitment_year_check" CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1900 AND 2100) AND
    ("yearTo" IS NULL OR "yearTo" BETWEEN 1900 AND 2100) AND
    ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  ),
  CONSTRAINT "ShopProductFitment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShopProductFitment_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "ShopVehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopProductFitment_productId_vehicleModelId_key" ON "ShopProductFitment"("productId", "vehicleModelId");
CREATE INDEX "ShopProductFitment_vehicleModelId_idx" ON "ShopProductFitment"("vehicleModelId");
CREATE INDEX "ShopProduct_isActive_isPublished_category_idx" ON "ShopProduct"("isActive", "isPublished", "category");
