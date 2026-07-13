'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, Money, ProductSummary } from '@/types';
import { api } from '@/lib/api';
import {
  optimisticAdd,
  optimisticSetQuantity,
  subtotalOf,
  itemCountOf,
  planCartMigration,
  MAX_PER_LINE,
} from './cart-logic';

/**
 * Cart store — Option A "sync on mutation". Zustand drives instant, optimistic
 * UI; every mutation fires the matching `/cart` call and the store then
 * RECONCILES to the authoritative server response (never to a stale local
 * snapshot — that would clobber a concurrent success). The backend cart, keyed
 * by the httpOnly `wh_sid` cookie, is the source of truth; `persist` keeps only
 * an optimistic offline cache.
 */
interface CartState {
  lines: CartLine[];
  /** True once the first server hydrate (GET /cart) has resolved. */
  hydrated: boolean;
  /** One-time, dismissible message (migration / mutation-failure). */
  notice: string | null;
  /** Persisted flag: has this browser done the first Option-A load? */
  migratedForServerCart: boolean;
  add: (input: { product: ProductSummary; quantity: number }) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  /** Load the authoritative cart from the server (after localStorage rehydration). */
  hydrate: () => Promise<void>;
  dismissNotice: () => void;
  itemCount: () => number;
  subtotal: () => Money;
}

// Single-flight queue: serialize ALL cart requests so their responses arrive in
// issue order. The backend does not order concurrent same-session writes
// (getOrCreate → upsert → re-read, non-transactional), so without this a
// later-issued request could commit/re-read an OLDER snapshot and win the guard
// below — making a just-added line briefly vanish. Serializing makes issue order
// a valid proxy for server-state recency.
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = chain.then(op, op); // run regardless of the previous op's outcome
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Only the response to the MOST-RECENTLY-ISSUED op is applied (older in-flight
// responses are dropped) — with the queue above, that op completes last and
// reflects the final server state, so this both avoids flicker and is correct.
let seqCounter = 0;
let latestSeq = 0;
const nextSeq = () => (latestSeq = ++seqCounter);

// Per-line debounce for the cart-page stepper: rapid +/- clicks collapse to ONE
// absolute PUT (setQuantity is non-commutative, so we must not race them).
const STEPPER_DEBOUNCE_MS = 350;
const stepperTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Clamp what actually goes on the wire to the backend DTO bounds (add: 1..20,
// setQuantity: 0..20). The optimistic layer already clamps the DISPLAY; without
// clamping the wire too, a stepper past 20 would send quantity:21, the backend
// @Max(20) would 400, and the item would spuriously vanish on reconcile.
const wireAddQty = (q: number) => Math.min(MAX_PER_LINE, Math.max(1, Math.trunc(q)));
const wireSetQty = (q: number) => Math.min(MAX_PER_LINE, Math.max(0, Math.trunc(q)));

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      const applyServer = (seq: number, lines: CartLine[]) => {
        if (seq !== latestSeq) return; // a newer op was issued — it will reconcile
        set({ lines, hydrated: true });
      };

      // On any mutation failure, DON'T restore a local snapshot (that clobbers a
      // concurrent success) — re-fetch the authoritative cart and drop the failed
      // optimistic delta.
      const reconcileFromServer = () => {
        const seq = nextSeq();
        enqueue(() => api.cart.get())
          .then((c) => applyServer(seq, c.lines))
          .catch(() => {
            /* offline: keep the optimistic cache rather than blanking the cart */
          });
      };
      const onMutationError = () => {
        set({ notice: 'We couldn’t update your cart — showing your latest saved cart.' });
        reconcileFromServer();
      };

      return {
        lines: [],
        hydrated: false,
        notice: null,
        migratedForServerCart: false,

        add: ({ product, quantity }) => {
          set((s) => ({ lines: optimisticAdd(s.lines, product, quantity) }));
          const seq = nextSeq();
          enqueue(() => api.cart.addItem({ productId: product.id, quantity: wireAddQty(quantity) }))
            .then((c) => applyServer(seq, c.lines))
            .catch(onMutationError);
        },

        setQuantity: (productId, quantity) => {
          set((s) => ({ lines: optimisticSetQuantity(s.lines, productId, quantity) }));
          const existing = stepperTimers.get(productId);
          if (existing) clearTimeout(existing);
          stepperTimers.set(
            productId,
            setTimeout(() => {
              stepperTimers.delete(productId);
              const seq = nextSeq();
              enqueue(() => api.cart.setQuantity(productId, wireSetQty(quantity)))
                .then((c) => applyServer(seq, c.lines))
                .catch(onMutationError);
            }, STEPPER_DEBOUNCE_MS),
          );
        },

        remove: (productId) => {
          // Deliberate single action: cancel any pending debounced write for this
          // line and fire immediately (setQuantity 0 deletes it server-side).
          const existing = stepperTimers.get(productId);
          if (existing) {
            clearTimeout(existing);
            stepperTimers.delete(productId);
          }
          set((s) => ({ lines: optimisticSetQuantity(s.lines, productId, 0) }));
          const seq = nextSeq();
          enqueue(() => api.cart.setQuantity(productId, 0))
            .then((c) => applyServer(seq, c.lines))
            .catch(onMutationError);
        },

        clear: () => {
          set({ lines: [] });
          const seq = nextSeq();
          enqueue(() => api.cart.clear())
            .then((c) => applyServer(seq, c.lines))
            .catch(onMutationError);
        },

        hydrate: async () => {
          const state = get();
          const plan = planCartMigration(state.migratedForServerCart, state.lines);
          set({
            lines: plan.clear ? [] : state.lines,
            migratedForServerCart: true,
            ...(plan.notice ? { notice: plan.notice } : {}),
          });
          const seq = nextSeq();
          try {
            const c = await enqueue(() => api.cart.get());
            applyServer(seq, c.lines);
          } catch {
            set({ hydrated: true }); // offline: keep the (post-migration) cache
          }
        },

        dismissNotice: () => set({ notice: null }),
        itemCount: () => itemCountOf(get().lines),
        subtotal: () => subtotalOf(get().lines),
      };
    },
    {
      name: 'wh-cart',
      // Only the optimistic cache + the migration flag survive a reload; the
      // server is re-fetched on load and wins. (No `version` bump: the wipe of a
      // pre-Option-A cart is done explicitly + notified in hydrate(), not via a
      // silent version-mismatch discard.)
      partialize: (state) => ({
        lines: state.lines,
        migratedForServerCart: state.migratedForServerCart,
      }),
    },
  ),
);
