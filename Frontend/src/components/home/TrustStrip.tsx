'use client';

import { Leaf, Shield, Sparkles, Heart, BadgeCheck, MapPin, type LucideIcon } from 'lucide-react';
import { useHomepage } from '@/hooks/use-homepage';

const ICONS: Record<string, LucideIcon> = {
  leaf:     Leaf,
  shield:   Shield,
  sparkles: Sparkles,
  heart:    Heart,
  check:    BadgeCheck,
  india:    MapPin,
};

/**
 * 6-pillar trust strip — mirrors the brand's printed trust-badge row:
 * Natural / No animal testing / No harmful chemicals / Dermatologically
 * tested / FDA approved / Clinically crafted in Bharat. Each pillar gets a soft blush
 * circle behind the icon to match the assets.
 */
export function TrustStrip() {
  const { data } = useHomepage();
  const pillars = data?.trust ?? [];
  if (pillars.length === 0) return null;

  return (
    <section className="relative py-8 sm:py-14">
      <div className="container-wide">
        <div className="rounded-[2rem] bg-white border border-navy-900/5 shadow-soft px-4 sm:px-8 py-6 sm:py-10">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-5 sm:gap-y-7 gap-x-3 sm:gap-x-4">
            {pillars.map((t) => {
              const Icon = ICONS[t.icon] ?? Leaf;
              return (
                <li key={t.title} className="flex flex-col items-center text-center gap-2">
                  <span className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blush-100 text-blush ring-1 ring-blush/20">
                    <Icon className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={1.6} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[13px] sm:text-[14px] font-bold text-navy-900">{t.title}</p>
                    <p className="text-[11px] sm:text-[12px] text-ink-muted">{t.subtitle}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
