-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gstRateSnapshot" INTEGER,
ADD COLUMN     "hsnSnapshot" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "r2Key" TEXT,
    "pdfBytes" BYTEA,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "fy" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("fy")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Store invoice-profile settings (placeholder values — real ones set at deploy).
INSERT INTO "StoreSetting" ("id","key","value","createdAt","updatedAt") VALUES
  (gen_random_uuid()::text, 'store.state',           '"Karnataka"', now(), now()),
  (gen_random_uuid()::text, 'store.stateCode',       '"29"',        now(), now()),
  (gen_random_uuid()::text, 'store.shippingGstRate', '18',          now(), now())
ON CONFLICT ("key") DO NOTHING;
