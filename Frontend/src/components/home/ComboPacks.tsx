'use client';

import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { formatPrice, discountPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { useCarouselArrows } from '@/hooks/use-carousel-arrows';
import { cn } from '@/lib/cn';

/**
 * Combo packs & gift hampers — one-per-view slider (client feedback: exactly
 * one combo visible at a time, swipe gesture + on-screen arrows). Each slide
 * keeps the wide gradient-banner card; first card brand-green, second navy.
 */
export function ComboPacks() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false });
  const { canPrev, canNext, scrollPrev, scrollNext } = useCarouselArrows(emblaApi);

  // aria-disabled (not the disabled attribute) so a keyboard user's focus
  // isn't dropped to <body> the moment an arrow hides at either end.
  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 h-11 w-11 inline-flex items-center justify-center rounded-full bg-white/90 text-navy-900 shadow-lift ring-1 ring-black/5 backdrop-blur-sm transition-opacity hover:bg-white';

  if (homepage.comboPacks.length === 0) return null;
  return (
    <section aria-label="Combo packs and gift hampers" className="section">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Better together"
          title="Combo Packs & Gift Hampers"
          subtitle="Hand-picked rituals at curated kit prices — the easiest way to start a complete routine."
          ctaLabel="See all combos"
          ctaHref="/shop?category=combo"
        />

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {homepage.comboPacks.map((p, idx) => {
                const off = discountPercent(p.price, p.compareAtPrice);
                const isPrimary = idx % 2 === 0;
                return (
                  <div key={p.id} className="flex-[0_0_100%] min-w-0 px-0.5">
                    <Link
                      href={`/shop/${p.slug}`}
                      className="group relative block overflow-hidden rounded-[2.25rem] shadow-soft hover:shadow-lift transition-all duration-300"
                      style={{
                        // Brand green stays the card fill (client call); the
                        // white copy gets its contrast from the scrim panel
                        // behind the text block, not from darkening the brand.
                        backgroundImage: isPrimary
                          ? 'linear-gradient(135deg, #7AC143 0%, #5fa430 60%, #487d25 100%)'
                          : 'linear-gradient(135deg, #1B3F5E 0%, #23506c 60%, #1F4360 100%)',
                      }}
                    >
                      {/* Decorative wash */}
                      <div
                        className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-40"
                        style={{ background: isPrimary ? '#a7e167' : '#7AC143' }}
                        aria-hidden="true"
                      />

                      <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:p-7 lg:p-8 text-white relative">
                        <div className="relative flex flex-col justify-center">
                          {/* Scrim behind the TEXT BLOCK only — white copy over
                              raw #7AC143 measures ~2:1; this panel carries the
                              copy past 4.5:1 while the brand green stays the
                              card fill (ratios re-measured from rendered
                              pixels at 390 and 1440). Darker end at the BOTTOM,
                              under the small price/compare row; the navy slide
                              is dark already and gets no scrim. */}
                          {isPrimary && (
                            <div
                              aria-hidden="true"
                              className="absolute -inset-3 sm:-inset-4 rounded-[1.5rem] bg-gradient-to-b from-black/40 to-black/50"
                            />
                          )}
                          <div className="relative flex flex-col gap-4">
                          <Badge tone={isPrimary ? 'limited' : 'new'} className="self-start">
                            <Gift className="h-3 w-3" /> Save {off ?? 28}%
                          </Badge>
                          <h3 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold leading-tight text-white text-balance">
                            {p.name}
                          </h3>
                          <p className="text-white text-sm leading-relaxed">{p.shortDescription}</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl sm:text-3xl font-bold">{formatPrice(p.price)}</span>
                            {/* Full white: at /80 the blend over the scrim's
                                lightest sampled pixel drops to ~3.6:1 —
                                strikethrough + size carry the hierarchy. */}
                            {p.compareAtPrice && (
                              <span className="text-sm text-white line-through">
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
                        </div>
                        <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-[1.75rem] overflow-hidden bg-white/10 ring-1 ring-white/20">
                          <Image
                            src={p.thumbnail.url}
                            alt={p.thumbnail.alt}
                            fill
                            sizes="(min-width: 640px) 50vw, 90vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={scrollPrev}
            aria-disabled={!canPrev}
            tabIndex={canPrev ? 0 : -1}
            aria-label="Previous combo"
            className={cn(arrowClass, 'left-2 sm:left-3', !canPrev && 'opacity-0 pointer-events-none')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-disabled={!canNext}
            tabIndex={canNext ? 0 : -1}
            aria-label="Next combo"
            className={cn(arrowClass, 'right-2 sm:right-3', !canNext && 'opacity-0 pointer-events-none')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
