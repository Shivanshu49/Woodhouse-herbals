'use client';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProductCard } from '@/components/product/ProductCard';
import { useHomepage } from '@/hooks/use-homepage';

export function NewArrivals() {
  const { data } = useHomepage();
  const items = data?.newArrivals ?? [];
  if (items.length === 0) return null;
  return (
    <section className="section bg-brand-500/8">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Just landed"
          title="New arrivals"
          subtitle="Fresh from our formulation lab: herbal innovations for the next chapter of your routine."
          ctaLabel="See what's new"
          ctaHref="/shop?sort=new"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
