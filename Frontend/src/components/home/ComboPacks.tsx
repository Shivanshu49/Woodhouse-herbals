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
 * keeps the wide gradient-banner card; first card teal (client picked the
 * concern-tile teal over brand green, July 2026 round), second navy.
 * Round three reversed the teal card's colour roles: the teal that used to
 * show only as a frame around the dark text panel is now the card fill the
 * copy sits on (same treatment as the navy slide), and the dark panel tone
 * moved out to the border. Both slides share the border treatment, each in
 * its own colour.
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
          subtitle="Hand-picked rituals & curated kits at pocket friendly prices, the easiest way to start a complete routine."
          ctaLabel="See all combos"
          ctaHref="/shop?category=combo"
        />

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {[
                ...homepage.comboPacks.map((pack) => ({ kind: 'pack' as const, id: pack.id, pack })),
                ...GIFT_HAMPERS.map((hamper) => ({ kind: 'hamper' as const, id: hamper.id, hamper })),
              ].map((slide, idx) => {
                const isPrimary = idx % 2 === 0;
                // Round-three colour reversal: teal (#34A99D, the concern-tile
                // pick) is the fill the copy sits on; the dark tone that used
                // to back the text block is now the border. The navy slide
                // keeps its fill and takes the same border treatment in its
                // own colour.
                const cardStyle = {
                  backgroundImage: isPrimary
                    ? 'linear-gradient(135deg, #34A99D 0%, #2b8c82 60%, #216b64 100%)'
                    : 'linear-gradient(135deg, #1B3F5E 0%, #23506c 60%, #1F4360 100%)',
                  borderColor: isPrimary ? '#113B36' : '#0E2336',
                };
                const chrome = (
                  <>
                    {/* Decorative wash */}
                    <div
                      className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-40"
                      style={{ background: isPrimary ? '#7fd8cd' : '#7AC143' }}
                      aria-hidden="true"
                    />
                    {/* Full-card scrim, not a text-block panel — white copy
                        over raw #34A99D measures ~2.9:1, and the swap keeps
                        the copy white per the brief, so the scrim (never the
                        brand teal itself) carries every text zone past
                        4.5:1. The navy slide is dark already and gets none. */}
                    {isPrimary && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/45"
                      />
                    )}
                  </>
                );

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
                        {chrome}
                        {/* sm:px-16 keeps copy clear of the floating arrows
                            (left-3 + h-11 reaches 56px in): with shorter
                            hamper columns the centered heading lands exactly
                            on the Prev arrow's track otherwise. */}
                        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:py-7 sm:px-16 lg:py-8 text-white relative sm:h-full">
                          <div className="relative flex flex-col justify-center">
                            <div className="relative flex flex-col gap-4">
                              <Badge tone="neutral" className="self-start">
                                <Gift className="h-3 w-3" /> Coming soon
                              </Badge>
                              <h3 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold leading-tight text-white text-balance">
                                {h.name}
                              </h3>
                              <p className="text-white text-sm leading-relaxed">{h.description}</p>
                            </div>
                          </div>
                          <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-[1.75rem] overflow-hidden bg-white/10 ring-1 ring-white/20">
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
                      {chrome}

                      <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 p-5 sm:p-7 lg:p-8 text-white relative sm:h-full">
                        <div className="relative flex flex-col justify-center">
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
                            {/* Full white: strikethrough + size carry the
                                hierarchy; a /80 tint only spends contrast
                                headroom the teal fill can't spare. */}
                            {p.compareAtPrice && (
                              <span className="text-sm text-white line-through">
                                {formatPrice(p.compareAtPrice)}
                              </span>
                            )}
                          </div>
                            {/* Dark glass, not light: white/20 over the bare
                                teal fill lets the chip's own tint push the
                                white label under 3:1 (measured 2.87:1). */}
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/25 backdrop-blur-sm border border-white/25 self-start px-4 py-2 text-[13px] font-bold transition-colors group-hover:bg-black/35">
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
