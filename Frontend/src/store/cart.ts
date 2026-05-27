'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, Money, ProductSummary } from '@/types';

interface CartState {
  lines: CartLine[];
  add: (input: { product: ProductSummary; quantity: number }) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  itemCount: () => number;
  subtotal: () => Money;
}

const zeroINR: Money = { amount: 0, currency: 'INR' as const };

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: ({ product, quantity }) => {
        set((state) => {
          const existing = state.lines.find((l) => l.productId === product.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === product.id
                  ? { ...l, quantity: l.quantity + quantity, lineTotal: { amount: l.unitPrice.amount * (l.quantity + quantity), currency: 'INR' as const } }
                  : l,
              ),
            };
          }
          const line: CartLine = {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            thumbnail: product.thumbnail.url,
            unitPrice: product.price,
            quantity,
            lineTotal: { amount: product.price.amount * quantity, currency: 'INR' as const },
          };
          return { lines: [...state.lines, line] };
        });
      },
      remove: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.productId === productId
                ? { ...l, quantity, lineTotal: { amount: l.unitPrice.amount * quantity, currency: 'INR' as const } }
                : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      clear: () => set({ lines: [] }),
      itemCount: () => get().lines.reduce((acc, l) => acc + l.quantity, 0),
      subtotal: () => ({
        amount: get().lines.reduce((acc, l) => acc + l.lineTotal.amount, 0),
        currency: 'INR' as const,
      }),
    }),
    {
      name: 'wh-cart',
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export { zeroINR };
