import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProductCard } from '@/components/product/ProductCard';
import { homepage } from '@/data/homepage';

export function Bestsellers() {
  return (
    <section className="section container-wide">
      <SectionHeader
        eyebrow="Loved by our community"
        title="Bestselling herbal heroes"
        subtitle="The products our customers reorder month after month — thoughtfully formulated with potent botanicals and clean actives."
        ctaLabel="Shop all bestsellers"
        ctaHref="/shop?sort=bestsellers"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {homepage.bestsellers.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
