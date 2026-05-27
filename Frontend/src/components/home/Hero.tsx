import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { homepage } from '@/data/homepage';

export function Hero() {
  const { hero } = homepage;
  const lines = hero.title.split('\n');

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-hero-gradient" />
      <div className="absolute inset-0 -z-10 bg-leaf-pattern opacity-70" aria-hidden="true" />

      <div className="container-wide pt-10 pb-16 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Copy */}
          <div className="lg:col-span-6 animate-fade-up">
            <span className="eyebrow">{hero.eyebrow}</span>
            <h1 className="mt-5 text-display-xl text-balance">
              {lines.map((l, i) => (
                <span key={i} className="block">
                  {l}
                </span>
              ))}
            </h1>
            <p className="mt-6 text-base sm:text-lg text-ink-muted max-w-xl text-balance">{hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={hero.ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-forest-900 text-cream h-14 px-8 text-base font-medium shadow-soft hover:bg-forest-800 hover:shadow-lift transition-all"
              >
                {hero.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ai/skin-analysis"
                className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-forest-900/10 px-5 h-14 text-sm font-medium text-forest-900 hover:bg-white"
              >
                <Sparkles className="h-4 w-4 text-clay-300" /> Take the skin quiz
              </Link>
            </div>

            <ul className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
              {[
                { Icon: Leaf, label: 'Plant-first formulas' },
                { Icon: ShieldCheck, label: 'Dermat-tested' },
                { Icon: Sparkles, label: 'Made in India' },
              ].map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 border border-forest-900/5">
                    <Icon className="h-4 w-4 text-forest-700" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className="lg:col-span-6 relative animate-fade-up">
            <div className="relative aspect-[5/6] sm:aspect-[6/5] lg:aspect-[5/6] rounded-[2.5rem] overflow-hidden shadow-lift">
              <Image
                src={hero.image}
                alt="Wood House Herbals skincare in a natural lifestyle scene"
                fill
                priority
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-forest-900/30 via-transparent to-transparent" />
              {hero.accent && (
                <div className="absolute left-5 bottom-5 rounded-full bg-cream/90 backdrop-blur px-4 py-2 text-xs font-medium text-forest-900 shadow-soft">
                  {hero.accent}
                </div>
              )}
            </div>

            {/* Floating product chip */}
            <div className="hidden sm:flex absolute -left-6 lg:-left-10 top-10 items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-lift border border-forest-900/5 animate-fade-up">
              <div className="h-12 w-12 rounded-xl bg-sand-100 overflow-hidden relative">
                <Image src="https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=200&q=80&auto=format&fit=crop" alt="Vit C serum" fill className="object-cover" />
              </div>
              <div>
                <p className="text-xs text-ink-muted">Top rated · Vit C</p>
                <p className="text-sm font-medium text-forest-900">4.7 · 821 reviews</p>
              </div>
            </div>

            {/* Floating offer chip */}
            <div className="hidden sm:flex absolute -right-4 lg:-right-8 bottom-12 items-center gap-2 rounded-2xl bg-clay-300 text-white px-4 py-3 shadow-lift">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Extra</p>
                <p className="text-sm font-semibold">20% OFF · GLOW20</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
