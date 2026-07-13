/**
 * Order + checkout shapes — mirror the backend `Order` (Prisma) row returned by
 * `POST /api/orders` and `GET /api/orders/:number`, and the Razorpay
 * initiate/verify payloads. Money is always integer paise.
 */

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  productImageSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  placedAt: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  appliedCouponCode: string | null;
  shippingFullName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  items: OrderItem[];
}

/**
 * THE checkout POST body — EXACTLY the address fields + an optional coupon code.
 * Never a price, total, subtotal, discount, line item, or quantity: the server
 * re-prices from live `Product.priceMinor`. This type IS the untrusted-cart
 * invariant made structural (Phase 5). Mirrors the backend `CreateOrderDto`.
 */
export interface CheckoutAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: 'IN';
  couponCode?: string;
}

export interface InitiateResponse {
  keyId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: 'INR';
  orderNumber: string;
}

export interface VerifyPayload {
  orderNumber: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyResponse {
  orderStatus: OrderStatus;
  outcome: string;
}
