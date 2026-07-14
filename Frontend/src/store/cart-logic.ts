import type { CartLine, Money, ProductSummary } from '@/types';

/**
 * Pure cart transforms — the optimistic-update logic, isolated from React,
 * zustand, and the network so it can be unit-tested directly (node:test).
 *
 * The store applies these OPTIMISTICALLY for instant UI, then reconciles to the
 * authoritative server cart (`api.cart.*` responses). These mirror the backend
 * semantics so the optimistic guess is usually already correct:
 *   - a per-line hard cap of 20 (cart.service.ts MAX_PER_LINE),
 *   - `add` = increment an existing line,
 *   - `setQuantity` = absolute write; <= 0 removes the line.
 */

export const MAX_PER_LINE = 20;

const inr = (amount: number): Money => ({ amount, currency: 'INR' });
const clampQty = (q: number) => Math.min(MAX_PER_LINE, Math.max(0, Math.trunc(q)));
const withTotal = (l: CartLine, quantity: number): CartLine => ({
  ...l,
  quantity,
  lineTotal: inr(l.unitPrice.amount * quantity),
});

/** Optimistically increment (or insert) a line — mirrors POST /cart/items. */
export function optimisticAdd(
  lines: CartLine[],
  product: ProductSummary,
  quantity: number,
): CartLine[] {
  const existing = lines.find((l) => l.productId === product.id);
  if (existing) {
    return lines.map((l) =>
      l.productId === product.id ? withTotal(l, clampQty(l.quantity + quantity)) : l,
    );
  }
  const q = clampQty(quantity);
  if (q === 0) return lines;
  return [
    ...lines,
    {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      thumbnail: product.thumbnail.url,
      unitPrice: product.price,
      quantity: q,
      lineTotal: inr(product.price.amount * q),
    },
  ];
}

/** Optimistically set an absolute quantity — mirrors PUT /cart/items/:id; <=0 removes. */
export function optimisticSetQuantity(
  lines: CartLine[],
  productId: string,
  quantity: number,
): CartLine[] {
  const q = clampQty(quantity);
  return lines
    .map((l) => (l.productId === productId ? withTotal(l, q) : l))
    .filter((l) => l.quantity > 0);
}

export function subtotalOf(lines: CartLine[]): Money {
  return inr(lines.reduce((acc, l) => acc + l.lineTotal.amount, 0));
}

export function itemCountOf(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.quantity, 0);
}

/**
 * One-time migration decision for the first Option-A (server-cart) load.
 *
 * A cart persisted BEFORE server sync existed holds product ids that were never
 * added to any backend cart (and, from before the catalog went live, may be
 * dead mock ids that 404 on re-add). Rather than a silent server-wins wipe, we
 * clear such a cart deliberately and tell the user once. A brand-new visitor
 * (no lines) is simply marked migrated with no notice.
 */
export function planCartMigration(
  migratedForServerCart: boolean,
  lines: CartLine[],
): { clear: boolean; notice: string | null } {
  if (!migratedForServerCart && lines.length > 0) {
    return { clear: true, notice: 'Your cart was reset for our new secure checkout.' };
  }
  return { clear: false, notice: null };
}
