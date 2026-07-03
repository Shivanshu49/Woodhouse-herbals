-- The DEFAULT existed only to backfill updatedAt on pre-existing rows when
-- the column was added; Prisma's @updatedAt maintains the value from now on.
ALTER TABLE "OfferStripItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
