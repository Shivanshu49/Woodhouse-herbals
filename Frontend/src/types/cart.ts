import type { Money, ProductSummary } from './product';

export type { Money };

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  thumbnail: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  itemCount: number;
}

export interface AddToCartInput {
  product: ProductSummary;
  quantity: number;
}
