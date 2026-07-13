import type { CartLine } from '@/types';

/**
 * Best-effort pre-pay reconciliation: compare the client's last-known cart
 * against the fresh server cart (`GET /cart`) and surface every visible change
 * so the user SEES it before paying — nothing is silently repriced. This is a
 * preview only; `GET /cart` runs no stock/soft-delete/coupon re-validation, so
 * the authoritative check still happens at `POST /orders` (handled separately by
 * the error-reason-driven recovery).
 */
export interface CartDelta {
  productId: string;
  kind: 'removed' | 'quantity-reduced' | 'price-changed';
  detail: string;
}

export function computeCartDeltas(clientLines: CartLine[], serverLines: CartLine[]): CartDelta[] {
  const server = new Map(serverLines.map((l) => [l.productId, l]));
  const deltas: CartDelta[] = [];
  for (const c of clientLines) {
    const s = server.get(c.productId);
    if (!s) {
      deltas.push({
        productId: c.productId,
        kind: 'removed',
        detail: `${c.name} is no longer available — removed from your order.`,
      });
      continue;
    }
    if (s.quantity < c.quantity) {
      deltas.push({
        productId: c.productId,
        kind: 'quantity-reduced',
        detail: `${c.name}: quantity reduced to ${s.quantity} (limited stock).`,
      });
    }
    if (s.unitPrice.amount !== c.unitPrice.amount) {
      const dir = s.unitPrice.amount > c.unitPrice.amount ? 'increased' : 'decreased';
      deltas.push({
        productId: c.productId,
        kind: 'price-changed',
        detail: `${c.name}: price ${dir} since you added it.`,
      });
    }
  }
  return deltas;
}
