-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('OPEN', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "status" "StockCountStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedStock" INTEGER NOT NULL,
    "expectedMovements" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCount_status_createdAt_idx" ON "StockCount"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StockCountLine_productId_idx" ON "StockCountLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountLine_countId_productId_key" ON "StockCountLine"("countId", "productId");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
