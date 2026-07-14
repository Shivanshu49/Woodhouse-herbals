'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useCartStore } from '@/store/cart';

/**
 * App-level cart bootstrap. Mounted once (in Providers), it:
 *  1. hydrates the authoritative server cart (GET /cart) once localStorage has
 *     rehydrated — so the header badge and cart page reflect the backend, and
 *     the one-time pre-Option-A migration runs before anything else touches it;
 *  2. surfaces the store's transient `notice` (migration / mutation-failure) as
 *     a small dismissible toast.
 */
export function CartSync() {
  const notice = useCartStore((s) => s.notice);
  const dismissNotice = useCartStore((s) => s.dismissNotice);

  useEffect(() => {
    const run = () => {
      void useCartStore.getState().hydrate();
    };
    // Wait for persist rehydration so the migration sees the real stored cart.
    if (useCartStore.persist.hasHydrated()) {
      run();
      return;
    }
    return useCartStore.persist.onFinishHydration(run);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => dismissNotice(), 6000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-navy-900 text-cream px-5 py-3 text-sm shadow-lift">
        <span>{notice}</span>
        <button
          type="button"
          onClick={dismissNotice}
          aria-label="Dismiss"
          className="text-cream/70 hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
