import { Leaf, Shield, Sparkles, Heart } from 'lucide-react';

const ICONS = { leaf: Leaf, shield: Shield, sparkles: Sparkles, heart: Heart } as const;

import { homepage } from '@/data/homepage';

export function TrustStrip() {
  return (
    <section className="border-y border-forest-900/5 bg-white/60">
      <div className="container-wide grid grid-cols-2 sm:grid-cols-4 gap-6 py-8 sm:py-10">
        {homepage.trust.map((t) => {
          const Icon = ICONS[t.icon as keyof typeof ICONS] ?? Leaf;
          return (
            <div key={t.title} className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest-900/5 text-forest-700 shrink-0">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-forest-900">{t.title}</p>
                <p className="text-xs text-ink-muted">{t.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
