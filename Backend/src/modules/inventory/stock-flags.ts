import { StockStatus } from '@prisma/client';

/**
 * Derive the denormalised stock flags a Product row carries alongside its
 * authoritative `stockQty`. Kept pure so it is unit-testable and reusable by
 * any write path that changes base-product stock (see stock-flags.test.ts).
 *
 * BACKORDER is intentionally not produced here: a manual admin adjustment only
 * ever lands a product in or out of stock. Backorder is an order-flow concept
 * driven by `allowBackorder` and is managed on the checkout path, not here.
 */
export function stockFlagsFor(qty: number): { inStock: boolean; stockStatus: StockStatus } {
  const inStock = qty > 0;
  return {
    inStock,
    stockStatus: inStock ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK,
  };
}
