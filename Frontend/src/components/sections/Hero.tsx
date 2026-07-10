'use client';

import { useCallback, useEffect, useState } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Banner {
  src: string;
  mobileSrc: string;
  alt: string;
  href: string;
}

// Brand hero banners carried over from the live storefront. Marketing copy +
// "Shop Now" are baked into the artwork, so each slide is just a clickable
// image linking to the relevant catalogue view. Each desktop banner (2.5:1)
// has an art-directed mobile variant (12:13, /banners/mobile/) — serum,
// facewash and night-gel are the original woodhouseherbals.com mobile
// creatives; sunscreen and face-washes are composed from the desktop sources.
const BANNERS: Banner[] = [
  {
    src: '/banners/banner-serum.jpg',
    mobileSrc: '/banners/mobile/banner-serum.jpg',
    alt: 'Wood House Vitamin C & Niacinamide face serum — shop now',
    href: '/shop?category=serum',
  },
  {
    src: '/banners/banner-facewash.jpg',
    mobileSrc: '/banners/mobile/banner-facewash.jpg',
    alt: 'Wood House Vitamin C & Salicylic face washes — shop now',
    href: '/shop?category=face-wash',
  },
  {
    src: '/banners/banner-night-gel.jpg',
    mobileSrc: '/banners/mobile/banner-night-gel.jpg',
    alt: 'Wood House Green Tea night gel — no more pimples, no more scars',
    href: '/shop/green-tea-night-repair-gel',
  },
  {
    src: '/banners/banner-sunscreen.jpg',
    mobileSrc: '/banners/mobile/banner-sunscreen.jpg',
    alt: 'Wood House Super UV SPF 50 sunscreen — shop now',
    href: '/shop',
  },
  {
    src: '/banners/banner-face-washes.jpg',
    mobileSrc: '/banners/mobile/banner-face-washes.jpg',
    alt: 'Wood House advanced face washes — nature-powered skincare',
    href: '/shop?category=face-wash',
  },
];

const AUTOPLAY_MS = 5000;

export function Hero() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Dependency-free autoplay: advances every AUTOPLAY_MS, pauses on hover/focus
  // and honours prefers-reduced-motion.
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
      aria-label="Featured products"
      aria-roledescription="carousel"
      className="relative w-full bg-brand-cream"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {BANNERS.map((b, i) => (
            <div
              key={b.src}
              className="relative flex-[0_0_100%] min-w-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${BANNERS.length}`}
            >
              <Link href={b.href} aria-label={b.alt} tabIndex={selected === i ? 0 : -1}>
                {/* Art direction (taller crop on phones) needs <picture>; both
                    sources go through getImageProps so the optimizer + srcset
                    aren't lost. The .98px keeps the source and Tailwind's sm:
                    (min-width 640) breakpoints gap-free at fractional widths. */}
                {(() => {
                  const priority = i === 0;
                  const { props: mobile } = getImageProps({
                    src: b.mobileSrc, alt: b.alt, width: 1200, height: 1300, sizes: '100vw', priority,
                  });
                  // Spread keeps getImageProps' camelCase fetchPriority — the
                  // installed React 18.3.1 knows that prop on <img> and warns on
                  // the lowercase form (verified against the dev console).
                  const { props: desktop } = getImageProps({
                    src: b.src, alt: b.alt, width: 2000, height: 800, sizes: '100vw', priority,
                  });
                  return (
                    <picture>
                      {/* <Image priority> would have preloaded the LCP banner; the
                          getImageProps migration loses that, so hoist media-scoped
                          preload links for slide 0 ourselves. */}
                      {priority && (
                        <>
                          <link rel="preload" as="image" imageSrcSet={mobile.srcSet} imageSizes={mobile.sizes} media="(max-width: 639.98px)" />
                          <link rel="preload" as="image" imageSrcSet={desktop.srcSet} imageSizes={desktop.sizes} media="(min-width: 640px)" />
                        </>
                      )}
                      <source
                        media="(max-width: 639.98px)"
                        srcSet={mobile.srcSet}
                        sizes={mobile.sizes}
                        width={mobile.width}
                        height={mobile.height}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        {...desktop}
                        alt={b.alt}
                        className="w-full h-auto aspect-[12/13] sm:aspect-[5/2] object-cover"
                      />
                    </picture>
                  );
                })()}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Prev / next — hidden on small screens where the baked-in CTA leads */}
      <button
        type="button"
        onClick={() => emblaApi?.scrollPrev()}
        aria-label="Previous slide"
        className="hidden sm:inline-flex absolute left-3 md:left-5 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/70 text-brand-forest backdrop-blur-sm hover:bg-white shadow-sm transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => emblaApi?.scrollNext()}
        aria-label="Next slide"
        className="hidden sm:inline-flex absolute right-3 md:right-5 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/70 text-brand-forest backdrop-blur-sm hover:bg-white shadow-sm transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {BANNERS.map((b, i) => (
          <button
            key={b.src}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={selected === i}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              selected === i ? 'w-6 bg-brand-forest' : 'w-2 bg-brand-forest/40 hover:bg-brand-forest/70',
            )}
          />
        ))}
      </div>
    </section>
  );
}
