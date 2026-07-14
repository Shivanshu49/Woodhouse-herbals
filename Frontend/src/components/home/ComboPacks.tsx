'use client';

import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useHomepage } from '@/hooks/use-homepage';
import { formatPrice, discountPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { useCarouselArrows } from '@/hooks/use-carousel-arrows';
import { cn } from '@/lib/cn';

/**
 * Combo packs & gift hampers — one-per-view slider (client feedback: exactly
 * one combo visible at a time, swipe gesture + on-screen arrows). Each slide
 * keeps the wide banner card. Colour history: round two picked the
 * concern-tile teal over brand green for the lead card; round three moved
 * the dark text-panel tone out to the border; the round-three follow-up
 * flattened EVERY slide to strictly #34A99D (client call from the live
 * render — the gradient + contrast scrim read as a different, darker
 * colour). Teal is mid-tone, so like the concern grid's teal tile the copy
 * runs full-opacity navy-950 (5.6:1; white only reaches ~2.9:1).
 *
 * Round five: the art panel is pinned aspect-square at EVERY breakpoint.
 * All slide art (combo kit shots + gift-box packshots) is exactly 1:1; the
 * old sm:h-full panel inherited the text column's arbitrary ratio, so
 * object-cover cut the top off the boxes (client: full image must show).
 * Keep any new combo/hamper art square, or it will crop again.
 */

/**
 * Gift hampers from the July 2026 asset drop (FOR HER / FOR HIM boxes).
 * Real kits, but not sellable SKUs yet — no price, no PDP — so they ride as
 * coming-soon teaser slides instead of catalog products (same pattern as
 * CategoryBar's hardcoded Shop All circle). Promote them to products.ts
 * entries once pricing lands.
 */
interface GiftHamper {
  id: string;
  name: string;
  description: string;
  image: string;
  alt: string;
}

const GIFT_HAMPERS: GiftHamper[] = [
  {
    id: 'gift-box-for-her',
    name: 'For Her Gift Box',
    description:
      'Derma Revive face wash, SPF 50 serum sunscreen, 21 herbs face and body scrub and body butter, packed in one gift ready box.',
    image: '/products/gift-box-for-her.jpg',
    alt: 'Wood House For Her gift box with Derma Revive face wash, SPF 50 sunscreen, herbal scrub and body butter',
  },
  {
    id: 'gift-box-for-him',
    name: 'For Him Gift Box',
    description:
      'Derma Revive face wash, SPF 50 serum sunscreen, bamboo charcoal face scrub and body butter, ready to gift.',
    image: '/products/gift-box-for-him.jpg',
    alt: 'Wood House For Him gift box with bamboo charcoal face scrub, SPF 50 sunscreen, Derma Revive face wash and body butter',
  },
];

export function ComboPacks() {
  const { data } = useHomepage();
  const comboPacks = data?.comboPacks ?? [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false });
  const { canPrev, canNext, scrollPrev, scrollNext } = useCarouselArrows(emblaApi);

  // aria-disabled (not the disabled attribute) so a keyboard user's focus
  // isn't dropped to <body> the moment an arrow hides at either end.
  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 h-11 w-11 inline-flex items-center justify-center rounded-full bg-white/90 text-navy-900 shadow-lift ring-1 ring-black/5 backdrop-blur-sm transition-opacity hover:bg-white';

  if (comboPacks.length === 0) return null;
  return (
    <section aria-label="Combo packs and gift hampers" className="section">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Better together"
          title="Combo Packs & Gift Hampers"
          subtitle="Hand-picked rituals & curated kits at pocket friendly prices, the easiest way to start a complete routine."
          ctaLabel="See all combos"
          ctaHref="/shop?category=combo"
        />

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {[
                ...comboPacks.map((pack) => ({ kind: 'pack' as const, id: pack.id, pack })),
                ...GIFT_HAMPERS.map((hamper) => ({ kind: 'hamper' as const, id: hamper.id, hamper })),
              ].map((slide) => {
                // Strictly #34A99D on every slide (client call): flat fill,
                // no gradient, no scrim, no decorative wash — anything
                // layered over the teal shifts the colour. Contrast comes
                // from flipping the copy to navy-950 instead. The border
                // keeps the dark tone from the round-three reversal.
                const cardStyle = {
                  backgroundColor: '#34A99D',
                  borderColor: '#113B36',
                };

                if (slide.kind === 'hamper') {
                  const h = slide.hamper;
                  return (
                    <div key={h.id} className="flex-[0_0_100%] min-w-0 px-0.5">
                      {/* Not a Link: no PDP exists until the hamper becomes a
                          real SKU, and a dead link reads worse than none. */}
                      <div
                        className="relative h-full overflow-hidden rounded-[2.25rem] border-[6px] shadow-soft"
                        style={cardStyle}
                      >
                        {/* sm:px-16 keeps copy clear of the floating arrows
                            (left-3 + h-11 reaches 56px in): with shorter
                            hamper columns the centered heading lands exactly
                            on the Prev arrow's track otherwise. */}
                        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:py-7 sm:px-16 lg:py-8 text-navy-950 relative sm:h-full">
                          <div className="relative flex flex-col justify-center">
                            <div className="relative flex flex-col gap-4">
                              <Badge tone="neutral" className="self-start">
                                <Gift className="h-3 w-3" /> Coming soon
                              </Badge>
                              <h3 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold leading-tight text-navy-950 text-balance">
                                {h.name}
                              </h3>
                              <p className="text-navy-950 text-sm leading-relaxed">{h.description}</p>
                            </div>
                          </div>
                          <div className="relative aspect-square rounded-[1.75rem] overflow-hidden bg-white/10 ring-1 ring-white/20">
                            <Image
                              src={h.image}
                              alt={h.alt}
                              fill
                              sizes="(min-width: 640px) 50vw, 90vw"
                              className="object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const p = slide.pack;
                const off = discountPercent(p.price, p.compareAtPrice);
                return (
                  <div key={p.id} className="flex-[0_0_100%] min-w-0 px-0.5">
                    <Link
                      href={`/shop/${p.slug}`}
                      className="group relative block h-full overflow-hidden rounded-[2.25rem] border-[6px] shadow-soft hover:shadow-lift transition-all duration-300"
                      style={cardStyle}
                    >

                      {/* sm:px-16 keeps copy clear of the floating arrows
                          (left-3 + h-11 reaches 56px in) on every slide past
                          the first, where the Prev arrow becomes visible. */}
                      <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:py-7 sm:px-16 lg:py-8 text-navy-950 relative sm:h-full">
                        <div className="relative flex flex-col justify-center">
                          <div className="relative flex flex-col gap-4">
                          <Badge tone="limited" className="self-start">
                            <Gift className="h-3 w-3" /> Save {off ?? 28}%
                          </Badge>
                          <h3 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold leading-tight text-navy-950 text-balance">
                            {p.name}
                          </h3>
                          <p className="text-navy-950 text-sm leading-relaxed">{p.shortDescription}</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl sm:text-3xl font-bold">{formatPrice(p.price)}</span>
                            {/* Full navy-950: on teal a /80 tint composites to
                                ~4.0:1 (the concern-tile rule) — strikethrough
                                + size carry the hierarchy instead. */}
                            {p.compareAtPrice && (
                              <span className="text-sm text-navy-950 line-through">
                                {formatPrice(p.compareAtPrice)}
                              </span>
                            )}
                          </div>
                            {/* Light glass for the dark copy (the quiz band's
                                eyebrow-chip recipe, 7.3:1 there). */}
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/25 backdrop-blur-sm border border-navy-950/15 self-start px-4 py-2 text-[13px] font-bold transition-colors group-hover:bg-white/35">
                              <Sparkles className="h-3.5 w-3.5" />
                              Shop the kit
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                        <div className="relative aspect-square rounded-[1.75rem] overflow-hidden bg-white/10 ring-1 ring-white/20">
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
