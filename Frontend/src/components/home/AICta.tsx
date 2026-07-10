import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

/**
 * Quiz CTA — the "not sure where to start" panel. Lives just above the
 * Trending Now reels and pushes users into the AI skin-analysis flow. Uses
 * the brand navy gradient with a citrus burst so it reads as a primary
 * action band.
 */
export function AICta() {
  return (
    <section className="container-wide py-10 sm:py-16">
      <div className="relative overflow-hidden rounded-[2.5rem] px-6 sm:px-12 py-12 sm:py-16 bg-navy-gradient">
        <div className="absolute inset-0 bg-leaf-pattern opacity-50" aria-hidden="true" />
        <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-citrus/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="h-3 w-3" />
              New · Powered by AI
            </span>
            <h3 className="mt-4 text-display-md text-cream text-balance leading-tight">
              Customised solution <span className="text-brand-300 italic font-light">for your skin concern.</span>
            </h3>
            <p className="mt-3 text-cream/75 text-balance leading-relaxed">
              Tell us your concerns and our AI ritual builder will recommend the exact products and routine for your skin or hair.
            </p>
          </div>
          <Link
            href="/ai/skin-analysis"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-brand-500 text-white h-14 px-7 text-base font-bold shadow-glow hover:bg-brand-600 active:scale-[0.98] transition-all"
          >
            Start the quiz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
