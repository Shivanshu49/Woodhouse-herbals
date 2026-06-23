import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { cn } from '@/lib/cn';

/**
 * Concern tiles. Each concern sits on its own flat, soothing pastel — no
 * gradients — with the product photo blended onto the pastel (mix-blend-multiply
 * drops the near-white product background so it floats on the colour) and calm
 * navy text below.
 */
const PASTEL: Record<string, string> = {
  mint:     'bg-pastel-mint',
  butter:   'bg-pastel-butter',
  sky:      'bg-pastel-sky',
  sand:     'bg-pastel-sand',
  blush:    'bg-pastel-blush',
  lavender: 'bg-pastel-lavender',
};

export function ShopByConcern() {
  return (
    <section className="section">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Curated for your skin"
          title="Shop by concern"
          subtitle="Pick what your skin needs today — we'll bring you a complete ritual built for it."
          ctaLabel="See all concerns"
          ctaHref="/shop"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {homepage.concerns.map((c) => (
            <Link
              key={c.slug}
              href={`/shop?concern=${c.slug}`}
              className={cn(
                'group flex flex-col overflow-hidden rounded-[1.75rem] shadow-soft ring-1 ring-navy-900/5 transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5',
                PASTEL[c.accent] ?? PASTEL.mint,
              )}
            >
              <div className="relative aspect-[5/4] overflow-hidden">
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover object-[center_40%] mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              <div className="flex-1 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
                <h3 className="font-display text-base sm:text-xl font-semibold text-navy-900 leading-tight">
                  {c.title}
                </h3>
                <p className="mt-1 text-[12px] sm:text-[13px] text-ink-muted line-clamp-2">{c.description}</p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-bold text-brand-700">
                  Explore
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
