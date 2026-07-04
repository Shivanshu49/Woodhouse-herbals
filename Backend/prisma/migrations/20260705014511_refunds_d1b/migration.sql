-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('PHONEPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "RefundDisposition" AS ENUM ('RETURNED', 'DAMAGED', 'LOST');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "disposition" "RefundDisposition" NOT NULL,
ADD COLUMN     "merchantRefundId" TEXT,
ADD COLUMN     "method" "RefundMethod" NOT NULL,
ADD COLUMN     "utrReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Refund_merchantRefundId_key" ON "Refund"("merchantRefundId");

-- CreateIndex: at most one non-FAILED refund per order (D1b exactly-once idempotency)
CREATE UNIQUE INDEX "refund_one_active_per_order" ON "Refund"("orderId") WHERE status <> 'FAILED'::"RefundStatus";
