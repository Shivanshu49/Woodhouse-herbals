import type { Product } from '@/types';
import { Leaf, Check, Sparkles } from 'lucide-react';

export function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="mt-16 grid lg:grid-cols-3 gap-8">
      <section className="lg:col-span-2 space-y-12">
        <div>
          <h2 className="text-display-md mb-4">About this product</h2>
          <p className="text-ink leading-relaxed text-balance">{product.longDescription}</p>
        </div>

        <div>
          <h3 className="font-display text-2xl text-forest-900 mb-5 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-forest-700" /> Hero ingredients
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {product.ingredients.map((ing) => (
              <div
                key={ing.name}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 border border-forest-900/5"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sage-200 text-forest-900 shrink-0">
                  <Leaf className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium text-forest-900">{ing.name}</p>
                  <p className="text-sm text-ink-muted">{ing.benefit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-2xl text-forest-900 mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-clay-300" /> Why you’ll love it
          </h3>
          <ul className="space-y-3">
            {product.benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-forest-900 text-cream shrink-0">
                  <Check className="h-3 w-3" />
                </span>
                <p className="text-ink">{b}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-2xl text-forest-900 mb-5">How to use</h3>
          <ol className="space-y-3">
            {product.howToUse.map((step, i) => (
              <li key={i} className="flex items-start gap-4 rounded-2xl bg-white p-4 border border-forest-900/5">
                <span className="font-display text-xl text-clay-300 shrink-0 w-8">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <aside className="rounded-3xl bg-sand-100/60 p-6 sm:p-7 h-fit lg:sticky lg:top-24 border border-forest-900/5">
        <h4 className="font-display text-xl text-forest-900 mb-4">Good to know</h4>
        <ul className="space-y-3 text-sm">
          {[
            ['Vegan & cruelty-free', 'Never tested on animals'],
            ['Free from parabens, sulphates & dyes', 'Clean formulation'],
            ['Made in India', 'GMP certified facility'],
            ['Dermatologically tested', 'Safe for daily use'],
          ].map(([title, sub]) => (
            <li key={title} className="flex items-start gap-3">
              <Check className="h-4 w-4 mt-1 text-forest-700 shrink-0" />
              <div>
                <p className="font-medium text-forest-900">{title}</p>
                <p className="text-ink-muted text-xs">{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
