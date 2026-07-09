import Image from 'next/image';
import { Star, Quote } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { testimonials } from '@/data/reviews';

/**
 * Customer testimonials. Card style: cream background card with a big brand
 * quote glyph in the corner, citrus-yellow stars, and a clean avatar row.
 */
export function Testimonials() {
  return (
    <section className="section bg-blush-100/40">
      <div className="container-wide">
        <SectionHeader
          align="center"
          eyebrow="Tried · Tested · Loved"
          title="Loved by millions of customers"
          titleClassName="uppercase"
          subtitle="Real reviews from real customers — see why they keep coming back."
        />
        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="relative rounded-3xl bg-white p-6 sm:p-7 border border-navy-900/5 shadow-soft hover:shadow-lift transition-shadow"
            >
              <Quote className="absolute right-5 top-5 h-9 w-9 text-brand-500/15" />
              <div
                className="flex items-center gap-0.5 mb-4"
                aria-label="5 star rating"
              >
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-citrus text-citrus" />
                ))}
              </div>
              <p className="text-navy-900 leading-relaxed text-balance text-[15px]">{t.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="relative h-11 w-11 rounded-full overflow-hidden ring-2 ring-brand-500/20">
                  <Image src={t.avatar} alt={t.name} fill sizes="44px" className="object-cover" />
                </div>
                <div className="leading-tight">
                  <p className="text-[14px] font-bold text-navy-900">{t.name}</p>
                  <p className="text-[12px] text-ink-muted">{t.handle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
