# Backend — working rules

## Database migrations

- **`prisma db push` is FORBIDDEN in this repo. Baseline resquash of the
  migration history is likewise forbidden.** The money-critical partial
  unique indexes (e.g. `refund_one_active_per_order`, the refund
  double-payout guard) exist ONLY as raw SQL inside their migrations —
  Prisma 5 cannot express them in `schema.prisma`, so `db push` or a
  regenerated history drops them silently. Schema changes go through
  `prisma migrate dev` / `migrate deploy` only.
- The authoritative list of protected indexes lives in
  `src/common/db/required-partial-indexes.ts`. Production refuses to boot
  without them; CI re-proves existence + behavior on every push
  (`scripts/assert-db-invariants.ts`). When a migration adds a new partial
  unique index, add it to that list in the same commit.

## Money-path discipline

- The atomic money paths (payment settle, refund initiate/settle, inventory
  CAS) are never modified as a rider on unrelated changes, and every
  money-touching change gets adversarial review before merge.
- Money is integer paise everywhere. Payment provider state is read from
  provider entity `status` fields, never from webhook event names or
  arrival order.
