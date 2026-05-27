import type { CartLine, Money } from './cart';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  lines: CartLine[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  shippingAddress: Address;
  billingAddress?: Address;
  placedAt: string;
}
