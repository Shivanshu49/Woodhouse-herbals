import Image from 'next/image';
import { Star, Quote } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { testimonials } from '@/data/reviews';

export function Testimonials() {
  return (
    <section className="section bg-sand-100/70">
      <div className="container-wide">
        <SectionHeader
          align="center"
          eyebrow="The reviews are in"
          title="Loved by 50,000+ glowing customers"
          subtitle="Real reviews from real customers — see why they keep coming back."
        />
        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="relative rounded-3xl bg-white p-6 sm:p-7 border border-forest-900/5 shadow-soft"
            >
              <Quote className="absolute right-5 top-5 h-7 w-7 text-sage-200" />
              <div className="flex items-center gap-1 text-clay-300 mb-4" aria-label="5 star rating">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-clay-300" />
                ))}
              </div>
              <p className="text-ink leading-relaxed text-balance">{t.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full overflow-hidden bg-sand-100">
                  <Image src={t.avatar} alt={t.name} fill sizes="40px" className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-medium text-forest-900">{t.name}</p>
                  <p className="text-xs text-ink-muted">{t.handle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
