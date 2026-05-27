import { Suspense } from 'react';
import { ShopGrid } from '@/components/shop/ShopGrid';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = {
  title: 'Shop all — herbal skincare & haircare',
  description: 'Browse all Wood House Herbals products. Filter by skin type, concern, category and price.',
};

export default function ShopPage() {
  return (
    <>
      <section className="bg-sand-100/50 border-b border-forest-900/5">
        <div className="container-wide py-10 sm:py-14">
          <span className="eyebrow">Catalogue</span>
          <h1 className="mt-4 text-display-lg text-balance">Every Wood House product</h1>
          <p className="mt-3 text-ink-muted max-w-2xl">
            Filter by skin type, hair concern, category, price or rating to find your next ritual essential.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="container-wide section grid lg:grid-cols-[280px_1fr] gap-10">
            <Skeleton className="h-[600px]" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4]" />
              ))}
            </div>
          </div>
        }
      >
        <ShopGrid />
      </Suspense>
    </>
  );
}
