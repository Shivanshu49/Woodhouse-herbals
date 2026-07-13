'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Star } from 'lucide-react';
import type { BestsellerProduct } from '@/lib/bestseller';
import { useCartStore } from '@/store/cart';

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) {
          return <Star key={i} className="h-4 w-4 fill-brand-coral text-brand-coral" />;
        }
        if (i === full && hasHalf) {
          return (
            <div key={i} className="relative h-4 w-4">
              <Star className="absolute inset-0 h-4 w-4 text-brand-coral" />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className="h-4 w-4 fill-brand-coral text-brand-coral" />
              </div>
            </div>
          );
        }
        return <Star key={i} className="h-4 w-4 text-brand-coral/40" />;
      })}
    </div>
  );
}

// <article> root with the button OUTSIDE the <Link> — interactive content
// inside an anchor is invalid HTML and confuses screen readers. Mirrors the
// New Arrivals ProductCard structure.
export function BestsellerCard({ product }: { product: BestsellerProduct }) {
  const addToCart = useCartStore((s) => s.add);

  return (
    <article className="group relative flex h-full flex-col bg-white rounded-3xl shadow-md hover:shadow-xl overflow-hidden transition-shadow duration-300">
      <Link href={`/shop/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-brand-cream">
          <Image
            src={product.image}
            alt={`${product.name} ${product.type}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="scale-[1.15] object-cover transition-transform duration-500 group-hover:scale-[1.21]"
          />
        </div>
        {/* flex column so the rating + price row can be pinned to the bottom of
            every card (mt-auto), keeping prices aligned regardless of how many
            lines the name/ingredient text wraps to. */}
        <div className="flex flex-1 flex-col p-3.5 pb-0 sm:p-5 sm:pb-0">
          <h3 className="font-display font-semibold text-brand-forest text-base sm:text-lg uppercase leading-tight line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
          <p className="mt-1 font-inter font-semibold text-brand-forest text-xs sm:text-sm uppercase tracking-wide">
            {product.type}{product.size ? `, ${product.size}` : ''}
          </p>
          <p className="mt-1 font-inter italic text-xs text-brand-forest/70 line-clamp-2">
            {product.ingredientLine}
          </p>
          <div className="mt-auto pt-4">
            <Stars rating={product.rating} />
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-brand-forest text-xl sm:text-2xl">₹</span>
              <span className="font-display font-bold text-brand-forest text-2xl sm:text-3xl leading-none">
                {product.price}
              </span>
              {product.compareAtPrice && (
                <span className="ml-1.5 sm:ml-2 font-inter text-xs sm:text-sm text-brand-forest/50 line-through">
                  ₹{product.compareAtPrice}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="px-3.5 pb-3.5 pt-3.5 sm:px-5 sm:pb-5">
        <button
          type="button"
          onClick={() => addToCart({ product: product.summary, quantity: 1 })}
          aria-label={`Add ${product.name} to cart`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-forest text-white py-2.5 text-[13px] font-bold hover:bg-brand-leaf active:scale-[0.98] transition-all"
        >
          <ShoppingBag className="h-4 w-4" />
          Add to Cart
        </button>
      </div>
    </article>
  );
}
