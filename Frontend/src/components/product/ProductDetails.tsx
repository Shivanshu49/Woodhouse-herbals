import type { Product } from '@/types';
import { Leaf, Check, Sparkles } from 'lucide-react';

export function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="mt-16 grid lg:grid-cols-3 gap-8">
      <section className="lg:col-span-2 space-y-12">
        <div>
          <h2 className="text-display-md mb-4">About this product</h2>
          <p className="text-navy-900/80 leading-relaxed text-balance text-[15px]">{product.longDescription}</p>
        </div>

        <div>
          <h3 className="font-display text-2xl font-semibold text-navy-900 mb-5 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
              <Leaf className="h-4 w-4" />
            </span>
            Hero ingredients
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {product.ingredients.map((ing) => (
              <div
                key={ing.name}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 border border-navy-900/5 shadow-soft hover:border-brand-500/30 transition-colors"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shrink-0">
                  <Leaf className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-bold text-navy-900">{ing.name}</p>
                  <p className="text-sm text-ink-muted">{ing.benefit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-2xl font-semibold text-navy-900 mb-5 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-citrus/20 text-citrus-600">
              <Sparkles className="h-4 w-4" />
            </span>
            Why you'll love it
          </h3>
          <ul className="space-y-3">
            {product.benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shrink-0">
                  <Check className="h-3 w-3" />
                </span>
                <p className="text-navy-900/85">{b}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-2xl font-semibold text-navy-900 mb-5">How to use</h3>
          <ol className="space-y-3">
            {product.howToUse.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl bg-white p-4 border border-navy-900/5 shadow-soft"
              >
                <span className="font-display text-xl font-bold text-brand-600 shrink-0 w-8">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-navy-900/85">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <aside className="rounded-3xl bg-white p-6 sm:p-7 h-fit lg:sticky lg:top-28 border border-navy-900/5 shadow-soft">
        <h4 className="font-display text-xl font-semibold text-navy-900 mb-4">Good to know</h4>
        <ul className="space-y-3 text-sm">
          {[
            ['Vegan & cruelty-free', 'Never tested on animals'],
            ['Free from parabens, sulphates & dyes', 'Clean formulation'],
            ['Made in India', 'GMP certified facility'],
            ['Dermatologically tested', 'Safe for daily use'],
          ].map(([title, sub]) => (
            <li key={title} className="flex items-start gap-3">
              <Check className="h-4 w-4 mt-1 text-brand-600 shrink-0" />
              <div>
                <p className="font-bold text-navy-900">{title}</p>
                <p className="text-ink-muted text-xs">{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
