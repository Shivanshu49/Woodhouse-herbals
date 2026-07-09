import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Leaf } from 'lucide-react';

/**
 * "From our garden to your shelf" — brand philosophy copy beside one strong
 * lifestyle photograph (client feedback: a single image, not the previous
 * four-tile ingredient grid).
 */

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
          <div className="lg:col-span-7">
            <div className="relative aspect-[5/4] lg:aspect-[4/3] overflow-hidden rounded-[2rem] shadow-soft ring-1 ring-navy-900/5">
              <Image
                src="/lifestyle/lifestyle-1.png"
                alt="Wood House Super UV sunscreen in use against a Himalayan pine forest"
                fill
                sizes="(min-width: 1024px) 55vw, 92vw"
                className="object-cover object-[center_32%]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
