import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { cn } from '@/lib/cn';

/**
 * Concern tiles. Client-specified backgrounds cycled in order by tile index:
 * olive → peach → lemon → teal → peach (Dullness moved from butter to peach
 * #FFBDA3, July 2026 round-three follow-up). The product photo renders in its
 * ORIGINAL colors (no blend mode / overlay) — the tile color only shows behind
 * the text block and around the image edges. Olive and teal are mid-tone, so
 * those tiles switch copy to navy-950: on olive the /80 sub still clears AA
 * (4.7:1), on teal it must stay full-opacity (5.6:1; /80 composites to 4.0:1).
 * The light tiles keep the standard navy/muted palette.
 */
const TILE_STYLES = [
  { bg: 'bg-tile-olive',  heading: 'text-navy-950', sub: 'text-navy-950/80', link: 'text-navy-950' },
  { bg: 'bg-tile-peach',  heading: 'text-navy-900', sub: 'text-ink-muted',   link: 'text-navy-900' },
  { bg: 'bg-tile-lemon',  heading: 'text-navy-900', sub: 'text-ink-muted',   link: 'text-brand-800' },
  { bg: 'bg-tile-teal',   heading: 'text-navy-950', sub: 'text-navy-950',    link: 'text-navy-950' },
  { bg: 'bg-tile-peach',  heading: 'text-navy-900', sub: 'text-ink-muted',   link: 'text-navy-900' },
];

export function ShopByConcern() {
  return (
    <section className="section">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Curated for your skin"
          title="Shop by concern"
          subtitle="Pick what your skin needs today, and we'll bring you a complete ritual built for it."
          ctaLabel="See all concerns"
          ctaHref="/shop"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {homepage.concerns.map((c, i) => {
            const tile = TILE_STYLES[i % TILE_STYLES.length];
            return (
              <Link
                key={c.slug}
                href={`/shop?concern=${c.slug}`}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-[1.75rem] shadow-soft ring-1 ring-navy-900/5 transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5',
                  tile.bg,
                )}
              >
                <div className="relative aspect-[5/4] overflow-hidden">
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover object-[center_40%] transition-transform duration-700 group-hover:scale-105"
                  />
                  {c.comingSoon && (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-navy-900/85 px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-cream">
                      Coming soon
                    </span>
                  )}
                </div>

                <div className="flex-1 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                  <h3 className={cn('font-display text-base sm:text-xl font-semibold leading-tight', tile.heading)}>
                    {c.title}
                  </h3>
                  <p className={cn('mt-1 text-[12px] sm:text-[13px] line-clamp-2', tile.sub)}>{c.description}</p>
                  <span className={cn('mt-2.5 inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-bold', tile.link)}>
                    Explore
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
