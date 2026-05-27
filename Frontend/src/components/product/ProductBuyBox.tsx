'use client';

import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Heart, Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import type { Product } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { formatPrice, discountPercent } from '@/lib/format';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { cn } from '@/lib/cn';

export function ProductBuyBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const addToCart = useCartStore((s) => s.add);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.has(product.id));
  const [added, setAdded] = useState(false);
  const off = discountPercent(product.price, product.compareAtPrice);

  function handleAdd() {
    addToCart({ product, quantity: qty });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="lg:sticky lg:top-24 self-start">
      <div className="flex flex-wrap items-center gap-2">
        {product.badges?.map((b) => (
          <Badge key={b.label} tone={b.tone}>
            {b.label}
          </Badge>
        ))}
        {off ? <Badge tone="sale">{off}% OFF</Badge> : null}
      </div>

      <h1 className="mt-3 text-display-md text-balance leading-tight">{product.name}</h1>
      <p className="mt-2 text-ink-muted text-balance">{product.shortDescription}</p>

      <div className="mt-4 flex items-center gap-3">
        <Rating value={product.rating} reviewCount={product.reviewCount} size="md" />
      </div>

      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-forest-900">{formatPrice(product.price)}</span>
        {product.compareAtPrice && (
          <span className="text-lg text-ink-subtle line-through">{formatPrice(product.compareAtPrice)}</span>
        )}
        {product.size && <span className="text-sm text-ink-muted">· {product.size}</span>}
      </div>
      <p className="mt-1 text-xs text-clay-300 font-medium">Inclusive of all taxes</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-forest-900/15 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-11 w-11 grid place-items-center text-forest-900 hover:bg-forest-900/5 rounded-l-full"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center font-medium" aria-live="polite">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="h-11 w-11 grid place-items-center text-forest-900 hover:bg-forest-900/5 rounded-r-full"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            'inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition-all',
            added ? 'bg-forest-700 text-cream' : 'bg-forest-900 text-cream hover:bg-forest-800',
          )}
        >
          <ShoppingBag className="h-4 w-4" />
          {added ? 'Added!' : 'Add to bag'}
        </button>
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-full border border-forest-900/15',
            isWishlisted ? 'bg-clay-300/10 text-clay-300' : 'bg-white text-forest-900 hover:bg-forest-900/5',
          )}
        >
          <Heart className="h-4 w-4" fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      <ul className="mt-7 grid sm:grid-cols-3 gap-3 text-sm">
        <li className="flex items-center gap-2 text-ink-muted">
          <Truck className="h-4 w-4 text-forest-700" /> Free shipping ₹499+
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <ShieldCheck className="h-4 w-4 text-forest-700" /> Dermat-tested
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <RefreshCw className="h-4 w-4 text-forest-700" /> 7-day easy returns
        </li>
      </ul>

      <div className="mt-8 grid grid-cols-2 gap-2 text-xs text-ink-muted">
        <div>SKU · <span className="text-forest-900 font-medium">{product.sku}</span></div>
        <div>Size · <span className="text-forest-900 font-medium">{product.size}</span></div>
      </div>
    </div>
  );
}
