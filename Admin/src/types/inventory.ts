export interface InventoryRow {
  id: string;
  name: string;
  sku: string;
  thumbnailUrl: string;
  stockQty: number;
  lowStockThreshold: number;
  stockStatus: string;
  inStock: boolean;
  trackInventory: boolean;
  isLow: boolean;
}

export interface InventoryList {
  items: InventoryRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface InventoryMovement {
  id: string;
  previousQty: number;
  newQty: number;
  delta: number;
  reason: string;
  note: string | null;
  actorName: string | null;
  order: { id: string; number: string } | null;
  createdAt: string;
}

export const ADJUST_REASONS = [
  'RESTOCK',
  'STOCK_INTAKE',
  'MANUAL_ADJUSTMENT',
  'RECONCILIATION',
  'DAMAGED',
  'RETURNED',
] as const;
