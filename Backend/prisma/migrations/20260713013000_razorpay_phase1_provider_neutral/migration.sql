-- ─────────────────────────────────────────────────────────────────────────────
-- Razorpay migration · Phase 1 — provider-neutral data model (plan §2a/§2b/§2d)
--
-- DEPLOY COUPLING: apply ONLY together with the code that ships the 'GATEWAY'
-- literals (same commit as this file). The enum rename makes old code's
-- method:'PHONEPE' writes a runtime error, and the regenerated Prisma client
-- makes the old literals a compile error. NEVER apply to an environment
-- running pre-Phase-1 code (plan CP1).
-- ─────────────────────────────────────────────────────────────────────────────

-- §2a — Payment.provider: drop the DB-level 'phonepe' default. The provider
-- stamp must be an explicit code-side write; a silent column default is how a
-- stale provider value survives a gateway swap unnoticed. DROP DEFAULT is
-- metadata-only; existing rows keep their stored value ('phonepe' —
-- historical truth).
ALTER TABLE "Payment" ALTER COLUMN "provider" DROP DEFAULT;

-- §2b — RefundMethod: rename the persisted enum value PHONEPE → GATEWAY.
-- Metadata-only (enum cells are 4-byte OIDs into pg_enum): every existing row
-- is re-labelled instantly, no table rewrite. RENAME VALUE has no
-- transaction-block restriction (unlike ADD VALUE), so it is safe inside the
-- single transaction Prisma Migrate wraps around this file. Per-provider
-- fidelity for historical rows is preserved via the linked Payment.provider
-- column plus each refund's stored rawResponse.
ALTER TYPE "RefundMethod" RENAME VALUE 'PHONEPE' TO 'GATEWAY';

-- Razorpay payment id (pay_…) — written at settlement from the CAPTURING
-- payment entity only; needed to create refunds (POST /v1/payments/:id/refund)
-- and for audit. Nullable: PhonePe-era rows and not-yet-captured payments
-- have none.
ALTER TABLE "Payment" ADD COLUMN "providerPaymentId" TEXT;

-- §2d data precondition — the unguarded PhonePe initiate minted a new Payment
-- row per click, so multiple INITIATED rows per order can exist; the partial
-- unique index below would refuse to build over them. Keep the NEWEST
-- INITIATED row per order (createdAt, id as deterministic tie-break), mark
-- the rest FAILED (superseded). No live storefront has ever run: these rows
-- are dev/staging artifacts, never captured money.
UPDATE "Payment" p
SET    "status" = 'FAILED'
WHERE  p."status" = 'INITIATED'
  AND EXISTS (
    SELECT 1
    FROM   "Payment" newer
    WHERE  newer."orderId" = p."orderId"
      AND  newer."status" = 'INITIATED'
      AND  (newer."createdAt" > p."createdAt"
            OR (newer."createdAt" = p."createdAt" AND newer."id" > p."id"))
  );

-- §2d — one INITIATED payment per order: closes the read-then-create race in
-- initiate (double-click / two tabs ⇒ two payable provider orders ⇒ possible
-- double charge surfacing only as a paid_on_non_pending anomaly). Same proven
-- technique as refund_one_active_per_order. Registered in
-- REQUIRED_PARTIAL_INDEXES: the prod boot gate and CI enforce its presence,
-- uniqueness, predicate, and behavior from the moment this migration lands.
CREATE UNIQUE INDEX "payment_one_initiated_per_order"
  ON "Payment"("orderId")
  WHERE "status" = 'INITIATED';
