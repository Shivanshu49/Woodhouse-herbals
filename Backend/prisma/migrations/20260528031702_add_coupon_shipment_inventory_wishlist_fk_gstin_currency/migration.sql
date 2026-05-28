-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryReason" ADD VALUE 'RESTOCK';
ALTER TYPE "InventoryReason" ADD VALUE 'MANUAL_ADJUSTMENT';
ALTER TYPE "InventoryReason" ADD VALUE 'DAMAGED';
ALTER TYPE "InventoryReason" ADD VALUE 'RETURNED';
ALTER TYPE "InventoryReason" ADD VALUE 'INITIAL_SEED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "ShipmentStatus" ADD VALUE 'LOST';
ALTER TYPE "ShipmentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "rawWebhook" JSONB;

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");
