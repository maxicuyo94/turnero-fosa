-- CreateEnum
CREATE TYPE "ShopBuyerKind" AS ENUM ('INDIVIDUAL', 'MECHANIC');

-- CreateEnum
CREATE TYPE "ShopDeliveryKind" AS ENUM ('PICKUP', 'SHIPPING');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'PAYMENT_REVIEW');

-- AlterEnum
ALTER TYPE "InventoryMovementKind" ADD VALUE 'SALE';

-- AlterTable
ALTER TABLE "ShopProduct" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'shop',
    "checkoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "shippingPostalCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pickupInstructions" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "buyerKind" "ShopBuyerKind" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "workshopName" TEXT,
    "deliveryKind" "ShopDeliveryKind" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "shippingFeeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "reservationHeld" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "preferenceId" TEXT,
    "checkoutUrl" TEXT,
    "tracking" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShopOrderStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_code_key" ON "ShopOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_accessTokenHash_key" ON "ShopOrder"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_requestKey_key" ON "ShopOrder"("requestKey");

-- CreateIndex
CREATE INDEX "ShopOrder_status_expiresAt_idx" ON "ShopOrder"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ShopOrder_createdAt_idx" ON "ShopOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrderItem_orderId_productId_key" ON "ShopOrderItem"("orderId", "productId");

-- CreateIndex
CREATE INDEX "ShopPayment_orderId_idx" ON "ShopPayment"("orderId");

-- CreateIndex
CREATE INDEX "ShopOrderEvent_orderId_createdAt_idx" ON "ShopOrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPayment" ADD CONSTRAINT "ShopPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderEvent" ADD CONSTRAINT "ShopOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
