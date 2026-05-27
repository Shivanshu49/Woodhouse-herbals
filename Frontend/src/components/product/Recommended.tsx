import type { ProductSummary } from '@/types';
import { ProductCard } from './ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function Recommended({ items }: { items: ProductSummary[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-20">
      <SectionHeader
        eyebrow="Pairs beautifully with"
        title="Complete your ritual"
        subtitle="Curated by our formulators to work with this product."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
