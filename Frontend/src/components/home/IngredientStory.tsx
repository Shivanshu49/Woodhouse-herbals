import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Leaf } from 'lucide-react';

/**
 * "From our garden to your shelf" — four ingredient tiles with brand-tinted
 * captions, laid out in a soft staggered grid that gives the section
 * visual rhythm without depending on real product photography.
 */
const INGREDIENTS = [
  {
    name: 'Vitamin C',
    note: 'Cold-pressed, stabilised · brightens & evens tone',
    image: '/products/exfoliating-face-wash.png',
    tint: 'from-citrus/60 via-citrus/30 to-transparent',
  },
  {
    name: 'Bhringraj',
    note: 'Ayurvedic strengthening for thinning hair',
    image: '/products/body-butter.png',
    tint: 'from-brand-700/70 via-brand-600/30 to-transparent',
  },
  {
    name: 'Rice Water',
    note: 'Fermented, brightening · glass-skin glow',
    image: '/products/rice-water-oats-scrub.png',
    tint: 'from-navy-900/70 via-navy-700/30 to-transparent',
  },
  {
    name: 'Green Tea',
    note: 'Antioxidant-rich · soothes & calms',
    image: '/products/neem-face-wash.png',
    tint: 'from-brand-700/70 via-brand-500/30 to-transparent',
  },
];

export function IngredientStory() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <span className="eyebrow">From our garden to your shelf</span>
            <h2 className="mt-4 text-display-lg text-balance">
              Real botanicals. Real science. <span className="italic font-light text-brand-600">Honest</span> formulations.
            </h2>
            <p className="mt-4 text-ink-muted max-w-md text-balance leading-relaxed">
              Every Wood House product is built around ingredients that are clinically proven, ethically sourced and gentle on your skin and the planet. Free from sulphates, silicones, parabens, dyes — and animal testing.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-5 py-2.5 text-sm font-semibold hover:bg-navy-800 transition-colors group"
            >
              <Leaf className="h-4 w-4 text-brand-500" />
              Discover our philosophy
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
            {INGREDIENTS.map((ing, i) => (
              <div
                key={ing.name}
                className="relative aspect-square overflow-hidden rounded-3xl shadow-soft ring-1 ring-navy-900/5"
                style={{ marginTop: i % 2 === 1 ? '2rem' : 0 }}
              >
                <Image
                  src={ing.image}
                  alt={ing.name}
                  fill
                  sizes="(min-width: 1024px) 30vw, 50vw"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${ing.tint}`} />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-white font-display text-xl font-semibold leading-tight drop-shadow">
                    {ing.name}
                  </p>
                  <p className="text-white/85 text-[12px] leading-snug mt-0.5">{ing.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
