import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { BestsellerProduct } from '@/data/bestsellers';

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

export function ProductCard({ product }: { product: BestsellerProduct }) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block bg-white rounded-3xl shadow-md hover:shadow-xl overflow-hidden transition-shadow duration-300"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-cream">
        <Image
          src={product.image}
          alt={`${product.name} ${product.type}`}
          fill
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <h3 className="font-display font-semibold text-brand-forest text-lg uppercase leading-tight">
          {product.name}
        </h3>
        <p className="mt-1 font-inter font-semibold text-brand-forest text-sm uppercase tracking-wide">
          {product.type}, {product.size}
        </p>
        <p className="mt-1 font-inter italic text-xs text-brand-forest/70">
          {product.ingredientLine}
        </p>
        <div className="mt-3">
          <Stars rating={product.rating} />
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-brand-forest text-2xl">₹</span>
          <span className="font-display font-bold text-brand-forest text-3xl leading-none">
            {product.price}
          </span>
          {product.compareAtPrice && (
            <span className="ml-2 font-inter text-sm text-brand-forest/50 line-through">
              ₹{product.compareAtPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
