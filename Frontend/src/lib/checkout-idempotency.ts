import type { CheckoutAddress } from '@/types/order';

/**
 * The checkout Idempotency-Key.
 *
 * `createFromCart` does `if (existing) return existing` keyed on this string and
 * NEVER compares the incoming DTO — so the key must fold in the submitted DTO,
 * not just the attempt. A literal network retry of the IDENTICAL request → same
 * key → safe replay (no duplicate order). An EDITED resubmit (e.g. the user goes
 * back and changes the address) → different key → a new order, so we never ship
 * the first, stale address. `attemptId` is a per-checkout-visit id; the DTO is
 * normalized the way the server sees it (trimmed, coupon upper-cased).
 *
 * Output is 64 lowercase hex chars → matches the server's `^[a-z0-9_-]{8,64}$/i`.
 */
export function normalizeCheckoutDto(dto: CheckoutAddress): string {
  return JSON.stringify({
    fullName: dto.fullName.trim(),
    phone: dto.phone.trim(),
    line1: dto.line1.trim(),
    line2: (dto.line2 ?? '').trim(),
    city: dto.city.trim(),
    state: dto.state.trim(),
    pincode: dto.pincode.trim(),
    country: dto.country ?? 'IN',
    couponCode: (dto.couponCode ?? '').trim().toUpperCase(),
  });
}

export async function checkoutIdempotencyKey(
  attemptId: string,
  dto: CheckoutAddress,
): Promise<string> {
  const input = `${attemptId}|${normalizeCheckoutDto(dto)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
