'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { Star, Quote } from 'lucide-react';
import { testimonials } from '@/data/reviews';

const AUTOPLAY_MS = 4000;

/**
 * Customer testimonials. Round-three follow-up: the text header became the
 * client's "Tried. Tested. Loved" banner artwork (the headline is baked into
 * the art, so an sr-only heading keeps the section named for assistive
 * tech), and the static grid became an auto-scrolling loop with the hero's
 * autoplay contract: pauses on hover/focus, honours prefers-reduced-motion.
 * Slides stay narrower than the viewport at every breakpoint so the 3-slide
 * loop always has room to move; the peeking next card doubles as the
 * scrollability hint since there are no arrows.
 */
export function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!emblaApi || paused) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [emblaApi, paused]);

  return (
    <section
      className="section bg-blush-100/40"
      aria-label="Customer reviews"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="container-wide">
        <h2 className="sr-only">Tried. Tested. Loved by millions of customers</h2>
        {/* rounded-3xl (24px) intentionally exceeds the artwork's own baked
            corner radius at any rendered width, so the white corner slivers
            in the source art never show. */}
        <div className="relative mb-6 sm:mb-10 overflow-hidden rounded-3xl shadow-soft">
          <Image
            src="/banners/reviews-banner.jpg"
            alt="Tried. Tested. Loved by millions of customers"
            width={1800}
            height={312}
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="w-full h-auto"
          />
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex -ml-5 sm:-ml-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="flex-[0_0_88%] sm:flex-[0_0_55%] lg:flex-[0_0_40%] min-w-0 pl-5 sm:pl-6"
              >
                <article className="relative h-full rounded-3xl bg-white p-6 sm:p-7 border border-navy-900/5 shadow-soft hover:shadow-lift transition-shadow">
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
