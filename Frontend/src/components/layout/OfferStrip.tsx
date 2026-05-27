import { Sparkles } from 'lucide-react';
import { homepage } from '@/data/homepage';

export function OfferStrip() {
  const items = homepage.offerStrip;
  const loop = [...items, ...items]; // duplicate for seamless marquee

  return (
    <div className="relative overflow-hidden bg-forest-900 text-cream">
      <div className="flex whitespace-nowrap animate-marquee">
        {loop.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3 px-6 py-2 text-xs sm:text-[13px] tracking-wide">
            <Sparkles className="h-3.5 w-3.5 text-sage-200" />
            <span>{item.headline}</span>
            <span className="text-cream/30">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
