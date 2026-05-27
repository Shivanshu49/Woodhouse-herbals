import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { formatPrice, discountPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

export function ComboPacks() {
  if (homepage.comboPacks.length === 0) return null;
  return (
    <section className="section">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Better together"
          title="Combo packs that save more"
          subtitle="Hand-picked rituals at curated kit prices — the easiest way to start a complete routine."
          ctaLabel="See all combos"
          ctaHref="/shop?category=combo"
        />

        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
          {homepage.comboPacks.slice(0, 2).map((p, idx) => {
            const off = discountPercent(p.price, p.compareAtPrice);
            return (
              <Link
                key={p.id}
                href={`/shop/${p.slug}`}
                className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br shadow-soft hover:shadow-lift transition-shadow"
                style={{
                  backgroundImage:
                    idx % 2 === 0
                      ? 'linear-gradient(135deg, #1F3A2E 0%, #324a39 100%)'
                      : 'linear-gradient(135deg, #C97A55 0%, #a5613f 100%)',
                }}
              >
                <div className="grid sm:grid-cols-2 gap-6 p-6 sm:p-8 text-cream relative">
                  <div className="flex flex-col gap-4 justify-center">
                    <Badge tone="sale" className="self-start">
                      <Gift className="h-3 w-3" /> Save {off ?? 28}%
                    </Badge>
                    <h3 className="font-display text-2xl sm:text-3xl leading-tight text-cream text-balance">
                      {p.name}
                    </h3>
                    <p className="text-cream/80 text-sm">{p.shortDescription}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold">{formatPrice(p.price)}</span>
                      {p.compareAtPrice && (
                        <span className="text-sm text-cream/60 line-through">{formatPrice(p.compareAtPrice)}</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      Shop the kit
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-3xl overflow-hidden bg-cream/10">
                    <Image
                      src={p.thumbnail.url}
                      alt={p.thumbnail.alt}
                      fill
                      sizes="(min-width: 1024px) 30vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
