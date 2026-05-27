import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Leaf } from 'lucide-react';

const INGREDIENTS = [
  {
    name: 'Vitamin C',
    note: 'Cold-pressed, stabilised',
    image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600&q=80&auto=format&fit=crop',
  },
  {
    name: 'Bhringraj',
    note: 'Ayurvedic strengthening',
    image: 'https://images.unsplash.com/photo-1602103928739-7f3b09b1a78f?w=600&q=80&auto=format&fit=crop',
  },
  {
    name: 'Rice Water',
    note: 'Fermented, brightening',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80&auto=format&fit=crop',
  },
  {
    name: 'Green Tea',
    note: 'Antioxidant-rich',
    image: 'https://images.unsplash.com/photo-1556228720-da4e85b0aa78?w=600&q=80&auto=format&fit=crop',
  },
];

export function IngredientStory() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <span className="eyebrow">From our garden to your shelf</span>
            <h2 className="mt-4 text-display-md text-balance">
              Real botanicals. Real science. Honest formulations.
            </h2>
            <p className="mt-4 text-ink-muted max-w-md text-balance">
              Every Wood House product is built around ingredients that are clinically proven, ethically sourced and
              gentle on your skin and the planet. Free from harsh chemicals, dyes and animal testing.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-forest-900 hover:text-forest-700 group"
            >
              <Leaf className="h-4 w-4" />
              Discover our philosophy
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
            {INGREDIENTS.map((ing, i) => (
              <div
                key={ing.name}
                className="relative aspect-square overflow-hidden rounded-3xl shadow-soft"
                style={{ marginTop: i % 2 === 1 ? '2rem' : 0 }}
              >
                <Image src={ing.image} alt={ing.name} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest-900/85 to-transparent p-4">
                  <p className="text-cream font-display text-lg leading-tight">{ing.name}</p>
                  <p className="text-cream/70 text-xs">{ing.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
