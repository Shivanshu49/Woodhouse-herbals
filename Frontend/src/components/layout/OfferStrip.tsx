'use client';

import { Sparkles } from 'lucide-react';
import { useHomepage } from '@/hooks/use-homepage';

/**
 * The thin offer band that sits above the header.
 *
 * Renders in the brand's vibrant green with cream type and a slow marquee, so
 * it reads as a promotional ribbon instead of the muted dark bar it used to be.
 *
 * Copy is admin-managed: it comes from the live `/homepage` payload (`offerStrip`)
 * so editing the offer strip in Admin changes it here — one source of truth. While
 * the payload loads (or on an outage) the ribbon simply doesn't render, rather than
 * flashing stale/mock copy.
 */
export function OfferStrip() {
  const { data } = useHomepage();
  const items = data?.offerStrip ?? [];
  if (items.length === 0) return null;
  const loop = [...items, ...items, ...items];

  return (
    <div
      className="relative overflow-hidden text-white"
      style={{ backgroundImage: 'linear-gradient(90deg, #5fa430 0%, #7AC143 50%, #5fa430 100%)' }}
      role="region"
      aria-label="Site-wide offers"
    >
      <div className="flex whitespace-nowrap animate-marquee will-change-transform">
        {loop.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 px-7 py-2 text-[12px] sm:text-[13px] font-medium tracking-wide"
          >
            <Sparkles className="h-3.5 w-3.5 text-white/85" />
            <span>{item.headline}</span>
            <span className="text-white/40">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}
