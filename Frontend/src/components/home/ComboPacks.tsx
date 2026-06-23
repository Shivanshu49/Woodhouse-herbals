import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Gift, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { formatPrice, discountPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

/**
 * Combo packs — two kit cards, each as a wide gradient banner with a clearly
 * called-out save percentage. First card uses the brand-green gradient, second
 * uses the navy gradient, so they read as a premium "before / after" set.
 */
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
            const isPrimary = idx % 2 === 0;
            return (
              <Link
                key={p.id}
                href={`/shop/${p.slug}`}
                className="group relative overflow-hidden rounded-[2.25rem] shadow-soft hover:shadow-lift transition-all duration-300"
                style={{
                  backgroundImage: isPrimary
                    ? 'linear-gradient(135deg, #7AC143 0%, #5fa430 60%, #487d25 100%)'
                    : 'linear-gradient(135deg, #1B3F5E 0%, #23506c 60%, #1F4360 100%)',
                }}
              >
                {/* Decorative wash */}
                <div
                  className="absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-50"
                  style={{ background: isPrimary ? '#a7e167' : '#7AC143' }}
                  aria-hidden="true"
                />

                <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:p-7 lg:p-8 text-white relative">
                  <div className="flex flex-col gap-4 justify-center">
                    <Badge tone={isPrimary ? 'limited' : 'new'} className="self-start">
                      <Gift className="h-3 w-3" /> Save {off ?? 28}%
                    </Badge>
                    <h3 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold leading-tight text-white text-balance">
                      {p.name}
                    </h3>
                    <p className="text-white/85 text-sm leading-relaxed">{p.shortDescription}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-bold">{formatPrice(p.price)}</span>
                      {p.compareAtPrice && (
                        <span className="text-sm text-white/55 line-through">
                          {formatPrice(p.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/25 self-start px-4 py-2 text-[13px] font-bold transition-colors group-hover:bg-white/30">
                      <Sparkles className="h-3.5 w-3.5" />
                      Shop the kit
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-[1.75rem] overflow-hidden bg-white/10 ring-1 ring-white/20">
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
