'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import type { ProductSummary } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { formatPrice, discountPercent } from '@/lib/format';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { cn } from '@/lib/cn';

export interface ProductCardProps {
  product: ProductSummary;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ProductCard({ product, className, variant = 'default' }: ProductCardProps) {
  const addToCart = useCartStore((s) => s.add);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.has(product.id));
  const discount = discountPercent(product.price, product.compareAtPrice);

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-3xl bg-white border border-navy-900/5 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-300 overflow-hidden',
        className,
      )}
    >
      <Link href={`/shop/${product.slug}`} className="relative block">
        {/* Image well — soft brand-tinted background so packs pop on white */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-cream via-white to-brand-500/8">
          <div className="absolute inset-0 bg-dot-grid opacity-60" aria-hidden="true" />
          <Image
            src={product.thumbnail.url}
            alt={product.thumbnail.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />

          {/* Badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <div className="flex flex-col items-start gap-1.5">
              {discount && discount > 0 && (
                <Badge tone="sale">{discount}% OFF</Badge>
              )}
              {product.badges?.map((b) => (
                <Badge key={b.label} tone={b.tone}>
                  {b.label}
                </Badge>
              ))}
            </div>
            <button
              type="button"
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={(e) => {
                e.preventDefault();
                toggleWishlist(product.id);
              }}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft transition-colors',
                isWishlisted ? 'text-blush' : 'text-navy-900 hover:text-blush',
              )}
            >
              <Heart className="h-4 w-4" fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Hover quick-add ribbon (desktop only) */}
          <div className="hidden sm:flex absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                addToCart({ product, quantity: 1 });
              }}
              className="pointer-events-auto w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 text-cream py-2.5 text-[13px] font-semibold hover:bg-navy-800"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Quick add
            </button>
          </div>
        </div>
      </Link>

      <div className={cn('flex flex-1 flex-col p-4 sm:p-5', variant === 'compact' && 'p-3')}>
        <div className="flex-1">
          <Rating value={product.rating} reviewCount={product.reviewCount} className="mb-2" />
          <Link href={`/shop/${product.slug}`} className="block">
            <h3 className="font-display text-[17px] sm:text-[18px] font-semibold leading-snug text-navy-900 hover:text-brand-700 transition-colors line-clamp-2">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 text-[13px] sm:text-sm text-ink-muted line-clamp-2 leading-snug">
            {product.shortDescription}
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[19px] font-bold text-navy-900">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-[13px] text-ink-subtle line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => addToCart({ product, quantity: 1 })}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2.5 text-[12px] font-bold text-white hover:bg-brand-600 transition-colors shadow-soft"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
