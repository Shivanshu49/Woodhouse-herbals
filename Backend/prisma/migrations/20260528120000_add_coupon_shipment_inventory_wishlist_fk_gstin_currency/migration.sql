-- Incremental migration on top of 20260528_production_pass_1.
-- All changes are additive (no DROP, no RENAME of existing values), so this
-- migration is safe to apply against any environment that successfully
-- applied the prior migration.

-- ── Coupon: optional human-readable description for admin UI ───────
ALTER TABLE "Coupon" ADD COLUMN "description" TEXT;

-- ── Shipment: courier webhook payload kept verbatim ────────────────
ALTER TABLE "Shipment" ADD COLUMN "rawWebhook" JSONB;

-- ── ShipmentStatus: add new lifecycle states ───────────────────────
-- Postgres requires ALTER TYPE ADD VALUE for enums. Each is
-- IF NOT EXISTS-guarded so re-running on a partial DB does not error.
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ── InventoryReason: align with admin-friendly vocabulary ──────────
ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS 'RESTOCK';
ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS 'MANUAL_ADJUSTMENT';
ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS 'DAMAGED';
ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS 'INITIAL_SEED';

-- ── InventoryMovement: order context, note, attributable creator ───
ALTER TABLE "InventoryMovement" ADD COLUMN "orderId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "note"    TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "createdBy" TEXT;
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- Product.wishlistedBy was previously named Product.wishlistItems. The
-- Prisma client name change does not produce SQL — there is no column on
-- Product backing this relation (the FK lives on WishlistItem.productId).
-- So no SQL change is required for the rename; this comment records the
-- intent for the migration history.
