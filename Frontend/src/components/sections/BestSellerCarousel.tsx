'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bestsellerProducts } from '@/data/bestsellers';
import { BestsellerCard } from '@/components/ui/BestsellerCard';

export function BestSellerCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: false,
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateButtons();
    emblaApi.on('select', updateButtons);
    emblaApi.on('reInit', updateButtons);
    return () => {
      emblaApi.off('select', updateButtons);
      emblaApi.off('reInit', updateButtons);
    };
  }, [emblaApi, updateButtons]);

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <section aria-label="Best sellers" className="bg-brand-teal py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="relative mb-10 md:mb-14">
          <h2 className="font-display text-4xl sm:text-5xl text-brand-forest leading-none text-center">
            <span className="font-bold not-italic">Best</span>{' '}
            <span className="font-normal italic">Seller</span>
          </h2>
          <div className="hidden md:flex items-center gap-3 absolute right-0 bottom-0">
            <button
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous products"
              className="h-11 w-11 inline-flex items-center justify-center rounded-full border-2 border-brand-forest text-brand-forest hover:bg-brand-forest hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand-forest"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next products"
              className="h-11 w-11 inline-flex items-center justify-center rounded-full border-2 border-brand-forest text-brand-forest hover:bg-brand-forest hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand-forest"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden -mx-2 sm:-mx-3" ref={emblaRef}>
            <div className="flex">
              {bestsellerProducts.map((product) => (
                <div
                  key={product.slug}
                  className="flex-[0_0_50%] md:flex-[0_0_33.333%] lg:flex-[0_0_25%] xl:flex-[0_0_20%] px-2 sm:px-3"
                >
                  <BestsellerCard product={product} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex md:hidden items-center justify-center gap-3">
            <button
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous products"
              className="h-11 w-11 inline-flex items-center justify-center rounded-full border-2 border-brand-forest text-brand-forest disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next products"
              className="h-11 w-11 inline-flex items-center justify-center rounded-full border-2 border-brand-forest text-brand-forest disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
