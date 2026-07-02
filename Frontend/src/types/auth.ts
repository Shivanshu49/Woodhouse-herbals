/**
 * Shapes returned by the backend auth + customers endpoints.
 * Mirrors Backend/src/modules/auth and /customers responses.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  phone?: string | null;
  avatarUrl?: string | null;
}

export type SkinType = 'OILY' | 'DRY' | 'COMBINATION' | 'SENSITIVE' | 'NORMAL' | 'ALL';

export interface CustomerAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  emailVerified: boolean;
  skinType: SkinType | null;
  primaryConcerns: string[];
  createdAt: string;
  addresses: CustomerAddress[];
  wishlistItems: { productId: string; createdAt: string }[];
  hasGoogle: boolean;
  hasPassword: boolean;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface CustomerOrder {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  totalMinor: number;
  currency: string;
  items: {
    id: string;
    productNameSnapshot: string;
    productImageSnapshot: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }[];
}
