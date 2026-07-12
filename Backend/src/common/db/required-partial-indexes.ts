import { Prisma } from '@prisma/client';
import { env } from '../config/env';

/**
 * DB-invariant gate: money-critical PARTIAL UNIQUE indexes.
 *
 * These indexes exist ONLY as raw SQL inside their owning migrations —
 * Prisma 5.x cannot express a partial index in schema.prisma, so nothing in
 * the schema text defends them. A squashed migration history, a
 * `prisma db push`, or a schema-regenerated database would drop them
 * SILENTLY, and with them the exactly-once guarantees they enforce
 * (`refund_one_active_per_order` is the double-payout guard).
 *
 * Defense in depth (Razorpay migration plan §2c):
 *   1. THIS boot-time assertion — production refuses to start without them.
 *   2. CI re-creates the DB from migrations and asserts existence + behavior
 *      (scripts/assert-db-invariants.ts).
 *   3. Tripwire comments on the owning models in schema.prisma.
 *
 * Adding an index here is one list entry; the boot gate and the CI script
 * both consume this list.
 */
export interface RequiredPartialIndex {
  /** pg index name, as created by the owning migration. */
  name: string;
  /** Migration directory that owns the CREATE UNIQUE INDEX statement. */
  migrationFile: string;
  /**
   * Verbatim fragments of the CANONICAL pg_get_indexdef output that carry the
   * index's meaning (column + predicate). A same-named index with the wrong
   * column or an inverted predicate must NOT pass the gate — UNIQUE+WHERE
   * presence alone proves nothing. Capture fragments from a real DB:
   *   SELECT indexdef FROM pg_indexes WHERE indexname = '<name>';
   */
  mustContain: readonly string[];
}

export const REQUIRED_PARTIAL_INDEXES: readonly RequiredPartialIndex[] = [
  {
    name: 'refund_one_active_per_order',
    migrationFile: '20260705014511_refunds_d1b',
    // Canonical PG16 indexdef: CREATE UNIQUE INDEX refund_one_active_per_order
    //   ON public."Refund" USING btree ("orderId") WHERE (status <> 'FAILED'::"RefundStatus")
    mustContain: ['("orderId")', "status <> 'FAILED'"],
  },
  {
    name: 'payment_one_initiated_per_order',
    migrationFile: '20260713013000_razorpay_phase1_provider_neutral',
    // Expected canonical PG16 indexdef: CREATE UNIQUE INDEX payment_one_initiated_per_order
    //   ON public."Payment" USING btree ("orderId") WHERE (status = 'INITIATED'::"PaymentStatus")
    mustContain: ['("orderId")', "status = 'INITIATED'"],
  },
];

export interface PgIndexRow {
  indexname: string;
  indexdef: string;
}

/**
 * Pure check: given the required list and the `pg_indexes` rows found,
 * return one human-readable error per violated invariant. An index must be
 * present, UNIQUE, and partial (carry a WHERE predicate) — an index that
 * "exists" but lost either qualifier no longer enforces anything.
 */
export function checkRequiredPartialIndexes(
  required: readonly RequiredPartialIndex[],
  rows: readonly PgIndexRow[],
): string[] {
  const byName = new Map(rows.map((r) => [r.indexname, r]));
  const errors: string[] = [];
  for (const idx of required) {
    const row = byName.get(idx.name);
    if (!row) {
      errors.push(
        `Required partial unique index "${idx.name}" is MISSING from the database. ` +
          `It is created by prisma/migrations/${idx.migrationFile}/migration.sql — ` +
          `re-apply that migration; never recreate this database via \`prisma db push\`.`,
      );
      continue;
    }
    if (!/\bUNIQUE\b/i.test(row.indexdef)) {
      errors.push(
        `Index "${idx.name}" exists but is not UNIQUE (indexdef: ${row.indexdef}). ` +
          `The exactly-once guarantee is gone — restore it from prisma/migrations/${idx.migrationFile}.`,
      );
    }
    if (!/\bWHERE\b/i.test(row.indexdef)) {
      errors.push(
        `Index "${idx.name}" exists but lost its WHERE predicate (indexdef: ${row.indexdef}). ` +
          `Restore the partial index from prisma/migrations/${idx.migrationFile}.`,
      );
    }
    for (const fragment of idx.mustContain) {
      if (!row.indexdef.includes(fragment)) {
        errors.push(
          `Index "${idx.name}" exists but its definition drifted — expected fragment ` +
            `${JSON.stringify(fragment)} not found (indexdef: ${row.indexdef}). A same-named ` +
            `index on the wrong column/predicate enforces nothing; restore it from ` +
            `prisma/migrations/${idx.migrationFile}.`,
        );
      }
    }
  }
  return errors;
}

/** The minimal Prisma surface this gate needs — keeps tests and callers honest. */
interface RawQueryable {
  $queryRaw<T>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
}

/**
 * Boot-time gate. Call once during bootstrap, before the app starts serving.
 * Production: any violation is fatal (process.exit(1)) — running a store
 * without the double-payout guard is strictly worse than not running it.
 * Dev/test: loud warning only, so a half-migrated local DB stays workable.
 */
export async function assertRequiredPartialIndexes(db: RawQueryable): Promise<void> {
  const names = REQUIRED_PARTIAL_INDEXES.map((i) => i.name);
  let rows: PgIndexRow[];
  try {
    rows = await db.$queryRaw<PgIndexRow[]>(
      Prisma.sql`SELECT indexname, indexdef FROM pg_indexes
                 WHERE schemaname = 'public' AND indexname IN (${Prisma.join(names)})`,
    );
  } catch (e) {
    // Unreachable DB is a different failure from a missing index: fail fast
    // with the gate's own message in prod (cannot VERIFY the invariants ⇒
    // do not serve money traffic); stay boot-tolerant in dev/test, matching
    // PrismaService.onModuleInit's swallowed $connect failure.
    // Prisma init errors lead with a newline — trim before taking line 1.
    const msg = ((e as Error)?.message ?? String(e)).trim().split('\n')[0];
    if (env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error(
        `❌ Cannot verify DB invariants — database unreachable at boot (${msg}). ` +
          'Refusing to start without proof that the money-critical indexes exist.',
      );
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.warn(`⚠ Skipping DB invariant check — database unreachable (${msg}).`);
    return;
  }
  const errors = checkRequiredPartialIndexes(REQUIRED_PARTIAL_INDEXES, rows);
  if (errors.length === 0) return;

  for (const e of errors) {
    // eslint-disable-next-line no-console
    console.error(`❌ DB invariant violated: ${e}`);
  }
  if (env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Refusing to start: money-critical partial unique indexes are missing or malformed.',
    );
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.warn('⚠ Continuing in non-production mode DESPITE violated DB invariants (see above).');
}
