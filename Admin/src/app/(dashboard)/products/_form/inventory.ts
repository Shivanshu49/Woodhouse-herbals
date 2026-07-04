/**
 * Inventory & shipping helpers. Stock counts and weight (in grams) are whole
 * non-negative integers; physical dimensions (cm) allow up to 2 decimals. The
 * INT_MAX range check lives in the schema, mirroring the pricing helpers.
 */

/** Parse a non-negative whole-number count. Tolerates commas/whitespace; null if invalid. */
export function parseCount(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

/** Parse a non-negative dimension (up to 2 decimal places); null if invalid. */
export function parseDimension(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

export interface InventoryInput {
  trackInventory: boolean;
  stockQty: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  shippingClass: string;
  freeShipping: boolean;
}

export interface InventoryPayload {
  trackInventory: boolean;
  allowBackorder: boolean;
  freeShipping: boolean;
  stockQty?: number;
  lowStockThreshold?: number;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  shippingClass?: string;
}

/**
 * Map the form's inventory/shipping fields to the backend payload. The boolean
 * flags are always sent; numeric fields are included only when provided. When
 * tracking is off, the stock fields are dropped — they don't apply.
 */
export function inventoryToPayload(v: InventoryInput): InventoryPayload {
  const out: InventoryPayload = {
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    freeShipping: v.freeShipping,
  };

  if (v.trackInventory) {
    const stock = v.stockQty.trim() ? parseCount(v.stockQty) : null;
    if (stock !== null) out.stockQty = stock;
    const low = v.lowStockThreshold.trim() ? parseCount(v.lowStockThreshold) : null;
    if (low !== null) out.lowStockThreshold = low;
  }

  const weight = v.weightGrams.trim() ? parseCount(v.weightGrams) : null;
  if (weight !== null) out.weightGrams = weight;

  const l = v.lengthCm.trim() ? parseDimension(v.lengthCm) : null;
  if (l !== null) out.lengthCm = l;
  const w = v.widthCm.trim() ? parseDimension(v.widthCm) : null;
  if (w !== null) out.widthCm = w;
  const h = v.heightCm.trim() ? parseDimension(v.heightCm) : null;
  if (h !== null) out.heightCm = h;

  if (v.shippingClass.trim()) out.shippingClass = v.shippingClass.trim();
  return out;
}
