import type { CustomerAddress } from '@/types/auth';
import type { CheckoutAddress } from '@/types/order';

/** Convert the customer address-book shape into the existing order wire DTO. */
export function savedAddressToCheckout(
  address: CustomerAddress,
  couponCode?: string,
): CheckoutAddress {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: 'IN',
    couponCode: couponCode ?? '',
  };
}

/** A fresh manual form, retaining only the independently-entered coupon. */
export function emptyCheckoutAddress(couponCode?: string): CheckoutAddress {
  return {
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'IN',
    couponCode: couponCode ?? '',
  };
}

export function preferredSavedAddress(addresses: CustomerAddress[]): CustomerAddress | undefined {
  return addresses.find((address) => address.isDefault) ?? addresses[0];
}
