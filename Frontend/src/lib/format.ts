import type { Money } from '@/types';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatPrice(money: Money | null | undefined): string {
  if (!money) return '';
  return INR.format(money.amount / 100);
}

export function rupees(amount: number): Money {
  return { amount: Math.round(amount * 100), currency: 'INR' };
}

export function discountPercent(price: Money, compareAt?: Money | null): number | null {
  if (!compareAt || compareAt.amount <= price.amount) return null;
  return Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}
