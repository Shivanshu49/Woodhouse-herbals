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
        'group relative flex flex-col rounded-3xl bg-white border border-forest-900/5 shadow-soft hover:shadow-lift transition-all duration-300 overflow-hidden',
        className,
      )}
    >
      <Link href={`/shop/${product.slug}`} className="relative block">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand-100">
          <Image
            src={product.thumbnail.url}
            alt={product.thumbnail.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
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
                'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-colors',
                isWishlisted ? 'text-clay-300' : 'text-forest-900 hover:text-clay-300',
              )}
            >
              <Heart className="h-4 w-4" fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </Link>

      <div className={cn('flex flex-1 flex-col p-4 sm:p-5', variant === 'compact' && 'p-3')}>
        <div className="flex-1">
          <Rating value={product.rating} reviewCount={product.reviewCount} className="mb-2" />
          <Link href={`/shop/${product.slug}`} className="block">
            <h3 className="font-display text-[17px] leading-snug text-forest-900 hover:text-forest-700 transition-colors line-clamp-2">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-ink-muted line-clamp-2">{product.shortDescription}</p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-forest-900">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-ink-subtle line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => addToCart({ product, quantity: 1 })}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-3.5 py-2 text-xs font-medium text-cream hover:bg-forest-800 transition-colors"
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
