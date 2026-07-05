/**
 * A tracked product is "low stock" when its quantity is at or below its own
 * threshold. Untracked products (trackInventory=false) are never low — their
 * stock number is informational only.
 */
export function isLowStock(input: {
  stockQty: number;
  lowStockThreshold: number;
  trackInventory: boolean;
}): boolean {
  return input.trackInventory && input.stockQty <= input.lowStockThreshold;
}
