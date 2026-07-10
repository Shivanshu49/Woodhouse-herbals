'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bestsellerProducts } from '@/data/bestsellers';
import { BestsellerCard } from '@/components/ui/BestsellerCard';
import { useCarouselArrows } from '@/hooks/use-carousel-arrows';
import { cn } from '@/lib/cn';

export function BestSellerCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: false,
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
  });
  const { canPrev, canNext, scrollPrev, scrollNext } = useCarouselArrows(emblaApi);

  // aria-disabled (not the disabled attribute) so a keyboard user's focus
  // isn't dropped to <body> the moment an arrow hides at either end.
  const arrowClass =
    'pointer-events-auto absolute top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-full bg-white/90 text-brand-forest shadow-lift ring-1 ring-black/5 backdrop-blur-sm transition-opacity hover:bg-white';

  return (
    <section aria-label="Best sellers" className="bg-brand-teal pt-6 pb-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <h2 className="mb-5 md:mb-12 font-display font-bold text-4xl sm:text-5xl text-brand-forest leading-none text-center">
          Best Seller
        </h2>

        <div className="relative">
          <div className="overflow-hidden -mx-1.5 sm:-mx-3" ref={emblaRef}>
            <div className="flex">
              {bestsellerProducts.map((product) => (
                <div
                  key={product.slug}
                  className="flex-[0_0_50%] md:flex-[0_0_33.333%] lg:flex-[0_0_25%] px-1.5 sm:px-3"
                >
                  <BestsellerCard product={product} />
                </div>
              ))}
            </div>
          </div>

          {/* Arrow overlay. The wrapper's aspect ratio mirrors one slide's width
              at each breakpoint (slides are square-imaged and 1/2, 1/3, 1/4 of
              the row), so its height ≈ the product image height and top-1/2
              centers the arrows on the IMAGE, not the whole card. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/1] md:aspect-[3/1] lg:aspect-[4/1]">
            <button
              type="button"
              onClick={scrollPrev}
              aria-disabled={!canPrev}
              tabIndex={canPrev ? 0 : -1}
              aria-label="Previous products"
              className={cn(arrowClass, 'left-1 sm:left-2', !canPrev && 'opacity-0 pointer-events-none')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-disabled={!canNext}
              tabIndex={canNext ? 0 : -1}
              aria-label="Next products"
              className={cn(arrowClass, 'right-1 sm:right-2', !canNext && 'opacity-0 pointer-events-none')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
