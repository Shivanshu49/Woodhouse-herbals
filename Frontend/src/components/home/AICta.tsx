import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

/**
 * Quiz CTA — the "not sure where to start" panel. Lives just above the
 * Trending Now reels and pushes users into the AI skin-analysis flow.
 * Round three: painted the concern grid's Anti-Aging tile colour
 * (bg-tile-teal #34A99D) across the band. Teal is mid-tone, so like that
 * tile the copy flips to full-opacity navy-950 (5.6:1; cream/white only
 * reaches ~2.9:1 and fails even the large-text bar) and the CTA goes navy
 * so it still reads as the primary action on green-family ground.
 * Strictly flat #34A99D (client call from the live render): the leaf
 * pattern and blur blobs tinted the band into a blotchy gradient, so no
 * decorative layer sits over the fill.
 */
export function AICta() {
  return (
    <section className="container-wide py-10 sm:py-16">
      <div className="relative overflow-hidden rounded-[2.5rem] px-6 sm:px-12 py-12 sm:py-16 bg-tile-teal">
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/25 text-navy-950 border border-navy-950/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="h-3 w-3" />
              New · Powered by AI
            </span>
            <h3 className="mt-4 text-display-md text-navy-950 text-balance leading-tight">
              Customised solution <span className="italic font-light">for your skin concern.</span>
            </h3>
            <p className="mt-3 text-navy-950 text-balance leading-relaxed">
              Tell us your concerns and our AI ritual builder will recommend the exact products and routine for your skin or hair.
            </p>
          </div>
          <Link
            href="/ai/skin-analysis"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-navy-900 text-white h-14 px-7 text-base font-bold shadow-lift hover:bg-navy-950 active:scale-[0.98] transition-all"
          >
            Start the quiz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
