import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

export function AICta() {
  return (
    <section className="container-wide">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 px-6 sm:px-12 py-12 sm:py-16">
        <div className="absolute inset-0 bg-leaf-pattern opacity-40" aria-hidden="true" />
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-clay-300/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-sage-300/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-cream/10 text-sage-200 px-3 py-1 text-xs uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              New · Powered by AI
            </span>
            <h3 className="mt-4 text-display-md text-cream text-balance">
              Not sure where to start? Take our 60-second skin quiz.
            </h3>
            <p className="mt-3 text-cream/75">
              Tell us your concerns and our AI ritual builder will recommend the exact products and routine for your skin or hair.
            </p>
          </div>
          <Link
            href="/ai/skin-analysis"
            className="inline-flex items-center gap-2 rounded-full bg-cream text-forest-900 h-14 px-7 text-base font-medium shadow-soft hover:bg-white"
          >
            Start the quiz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
