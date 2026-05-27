import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { homepage } from '@/data/homepage';
import { cn } from '@/lib/cn';

const ACCENT_BG: Record<string, string> = {
  forest: 'from-forest-900/85 to-forest-700/60',
  clay: 'from-clay-400/85 to-clay-300/60',
  sage: 'from-forest-700/80 to-sage-300/40',
  sand: 'from-clay-300/70 to-sand-300/50',
};

export function ShopByConcern() {
  return (
    <section className="section bg-cream-200/40">
      <div className="container-wide">
        <SectionHeader
          eyebrow="Curated for your skin"
          title="Shop by concern"
          subtitle="Pick what your skin needs today — we’ll bring you a complete ritual built for it."
          ctaLabel="See all concerns"
          ctaHref="/concerns"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {homepage.concerns.map((c) => (
            <Link
              key={c.slug}
              href={`/shop?concern=${c.slug}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-3xl shadow-soft hover:shadow-lift transition-shadow"
            >
              <Image
                src={c.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className={cn('absolute inset-0 bg-gradient-to-tr', ACCENT_BG[c.accent])} />
              <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between text-cream">
                <span className="text-xs uppercase tracking-[0.18em] text-cream/80">Concern</span>
                <div>
                  <h3 className="font-display text-xl sm:text-2xl text-cream leading-tight">{c.title}</h3>
                  <p className="mt-1 text-sm text-cream/80 line-clamp-2">{c.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
                    Explore
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
