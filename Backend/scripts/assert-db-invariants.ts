/**
 * CI DB-invariant assertions (Razorpay migration plan §2c item 2).
 *
 * Runs in the backend-check CI job right after `prisma migrate deploy`
 * rebuilt the service-container Postgres from the migration history, and
 * proves two things about the money-critical partial unique indexes:
 *
 *   A. EXISTENCE + SHAPE — every index in REQUIRED_PARTIAL_INDEXES is
 *      present, UNIQUE, and partial (same validator the prod boot gate uses).
 *   B. BEHAVIOR — the refund double-payout guard actually rejects a second
 *      non-FAILED refund for one order (unique violation), while a FAILED +
 *      non-FAILED pair is allowed. An index that exists but doesn't enforce
 *      is treated as absent.
 *
 * A squashed/edited migration history that loses the raw-SQL indexes fails
 * here at PR time, before the boot gate would refuse a production deploy.
 *
 * Run locally: DATABASE_URL=... npx tsx scripts/assert-db-invariants.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  REQUIRED_PARTIAL_INDEXES,
  checkRequiredPartialIndexes,
  type PgIndexRow,
} from '../src/common/db/required-partial-indexes';

const MARKER = 'WH-CIINVARIANT';

/**
 * Report violations and abort — by THROWING, not process.exit(1): exit()
 * would skip the `finally` blocks that clean the probe rows out of the
 * target DB and disconnect the client. main()'s catch sets the exit code.
 */
function fail(messages: string[]): never {
  for (const m of messages) {
    console.error(`❌ ${m}`);
  }
  throw new Error('DB invariant assertion failed (see ❌ lines above)');
}

async function assertExistenceAndShape(prisma: PrismaClient): Promise<void> {
  const names = REQUIRED_PARTIAL_INDEXES.map((i) => i.name);
  const rows = await prisma.$queryRaw<PgIndexRow[]>(
    Prisma.sql`SELECT indexname, indexdef FROM pg_indexes
               WHERE schemaname = 'public' AND indexname IN (${Prisma.join(names)})`,
  );
  const errors = checkRequiredPartialIndexes(REQUIRED_PARTIAL_INDEXES, rows);
  if (errors.length) fail(errors);
  console.log(`✔ ${names.length} required partial unique index(es) present and well-shaped`);
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  // Refunds/payments cascade with the order; delete-by-marker keeps reruns clean.
  await prisma.order.deleteMany({ where: { number: MARKER } });
}

/** §2a — Payment.provider must have NO column default (explicit writes only). */
async function assertProviderHasNoDefault(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ column_default: string | null }[]>(
    Prisma.sql`SELECT column_default FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'Payment'
                 AND column_name = 'provider'`,
  );
  if (rows.length !== 1) {
    fail(['Payment.provider column not found — schema drift?']);
  }
  if (rows[0]!.column_default !== null) {
    fail([
      `Payment.provider still carries a column default (${rows[0]!.column_default}) — ` +
        'the provider stamp must be an explicit code-side write. Re-apply ' +
        'prisma/migrations/20260713013000_razorpay_phase1_provider_neutral.',
    ]);
  }
  console.log('✔ Payment.provider has no column default (explicit provider writes only)');
}

/** §2b — RefundMethod enum labels must be exactly {GATEWAY, MANUAL}. */
async function assertRefundMethodLabels(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ enumlabel: string }[]>(
    Prisma.sql`SELECT e.enumlabel FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'RefundMethod'
               ORDER BY e.enumlabel`,
  );
  const labels = rows.map((r) => r.enumlabel);
  const expected = ['GATEWAY', 'MANUAL'];
  if (JSON.stringify(labels) !== JSON.stringify(expected)) {
    fail([
      `RefundMethod enum labels are [${labels.join(', ')}], expected [${expected.join(', ')}] — ` +
        'the legacy→GATEWAY rename (20260713013000_razorpay_phase1_provider_neutral) is missing ' +
        'or the enum drifted.',
    ]);
  }
  console.log('✔ RefundMethod enum labels are exactly {GATEWAY, MANUAL}');
}

/** §2d — behavioral: one INITIATED payment per order; FAILED attempts coexist. */
async function assertDoubleMintGuardBehavior(prisma: PrismaClient): Promise<void> {
  await cleanup(prisma);
  const order = await prisma.order.create({
    data: {
      number: MARKER,
      subtotalMinor: 100,
      totalMinor: 100,
      shippingFullName: 'CI Invariant Probe',
      shippingPhone: '9999999999',
      shippingLine1: 'nowhere',
      shippingCity: 'Mumbai',
      shippingState: 'Maharashtra',
      shippingPincode: '400001',
    },
    select: { id: true },
  });

  try {
    const base = { orderId: order.id, provider: 'ci-probe', amountMinor: 100 } as const;

    // A FAILED (superseded/abandoned) attempt must NOT occupy the guard…
    await prisma.payment.create({ data: { ...base, status: 'FAILED' } });
    // …a first INITIATED payment claims it…
    await prisma.payment.create({ data: { ...base, status: 'INITIATED' } });

    // …and a second concurrent INITIATED mint must be rejected.
    let rejected = false;
    try {
      await prisma.payment.create({ data: { ...base, status: 'INITIATED' } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        rejected = true;
      } else {
        throw e;
      }
    }
    if (!rejected) {
      fail([
        'DOUBLE-MINT GUARD DID NOT FIRE: a second INITIATED payment for the same order was ' +
          'accepted. payment_one_initiated_per_order exists in name but does not enforce — ' +
          'restore it from prisma/migrations/20260713013000_razorpay_phase1_provider_neutral.',
      ]);
    }
    console.log('✔ double-mint guard behavior: second INITIATED payment rejected (P2002/23505)');
    console.log('✔ FAILED + INITIATED payments coexist (supersede/retry stays possible)');
  } finally {
    await cleanup(prisma);
  }
}

async function assertDoublePayoutGuardBehavior(prisma: PrismaClient): Promise<void> {
  await cleanup(prisma);
  const order = await prisma.order.create({
    data: {
      number: MARKER,
      subtotalMinor: 100,
      totalMinor: 100,
      shippingFullName: 'CI Invariant Probe',
      shippingPhone: '9999999999',
      shippingLine1: 'nowhere',
      shippingCity: 'Mumbai',
      shippingState: 'Maharashtra',
      shippingPincode: '400001',
    },
    select: { id: true },
  });

  try {
    const base = {
      orderId: order.id,
      amountMinor: 100,
      method: 'MANUAL',
      disposition: 'RETURNED',
    } as const;

    // A FAILED refund must NOT occupy the guard…
    await prisma.refund.create({ data: { ...base, status: 'FAILED' } });
    // …a first non-FAILED refund claims it…
    await prisma.refund.create({ data: { ...base, status: 'PENDING' } });

    // …and a second non-FAILED refund must be rejected by the partial index.
    let rejected = false;
    try {
      await prisma.refund.create({ data: { ...base, status: 'PROCESSED' } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        rejected = true; // P2002 = Postgres 23505 unique_violation surfaced by Prisma
      } else {
        throw e;
      }
    }
    if (!rejected) {
      fail([
        'DOUBLE-PAYOUT GUARD DID NOT FIRE: a second non-FAILED refund for the same order ' +
          'was accepted. refund_one_active_per_order exists in name but does not enforce — ' +
          'restore it from prisma/migrations/20260705014511_refunds_d1b/migration.sql.',
      ]);
    }
    console.log('✔ double-payout guard behavior: second non-FAILED refund rejected (P2002/23505)');
    console.log('✔ FAILED + non-FAILED refunds coexist (retries stay possible)');
  } finally {
    await cleanup(prisma);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await assertExistenceAndShape(prisma);
    await assertProviderHasNoDefault(prisma);
    await assertRefundMethodLabels(prisma);
    // The behavior probes WRITE rows into the money tables. Never run them
    // against a production database — shape/catalog checks only there. CI
    // and local scratch DBs run the full probes.
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠ NODE_ENV=production — skipping the write-probing behavior tests (shape checks only)');
    } else {
      await assertDoublePayoutGuardBehavior(prisma);
      await assertDoubleMintGuardBehavior(prisma);
    }
    console.log('✔ all DB invariants hold');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  if ((e as Error)?.message?.startsWith('DB invariant assertion failed')) {
    console.error(`❌ ${(e as Error).message}`); // violations already printed above
  } else {
    console.error('❌ DB invariant assertion crashed:', e);
  }
  process.exit(1);
});
