'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Instagram, Play, X } from 'lucide-react';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, reelEmbedUrl, reelUrl, reels } from '@/data/reels';
import { useCarouselArrows } from '@/hooks/use-carousel-arrows';
import { cn } from '@/lib/cn';

function ReelModal({ shortcode, onClose }: { shortcode: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Instagram reel"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[24rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <a
            href={reelUrl(shortcode)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white text-sm font-inter"
          >
            <Instagram className="h-4 w-4" />
            Open on Instagram
          </a>
          <button
            onClick={onClose}
            aria-label="Close reel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-hidden rounded-3xl bg-black aspect-[9/16] max-h-[78vh] mx-auto">
          <iframe
            src={reelEmbedUrl(shortcode)}
            title="Instagram reel"
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

export function ReelsSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: false,
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
  });
  const { canPrev, canNext, scrollPrev, scrollNext } = useCarouselArrows(emblaApi);
  const [openReel, setOpenReel] = useState<string | null>(null);

  // aria-disabled (not the disabled attribute) so a keyboard user's focus
  // isn't dropped to <body> when an arrow deactivates at either end — the
  // same pattern as the Best Seller and combo sliders.
  const arrowClass =
    'h-11 w-11 inline-flex items-center justify-center rounded-full border-2 border-brand-forest text-brand-forest transition-colors';

  return (
    <section aria-label="Trending now" className="bg-white py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="relative mb-4">
          {/* Uppercase via CSS, not baked into the copy — keeps the source text
              readable to screen readers and consistent with sibling headings. */}
          <h2 className="font-display text-4xl sm:text-5xl text-brand-forest leading-none text-center uppercase">
            <span className="font-bold not-italic">Trending</span>{' '}
            <span className="font-normal italic">Now</span>
          </h2>
          <div className="hidden md:flex items-center gap-3 absolute right-0 bottom-0">
            <button
              onClick={scrollPrev}
              aria-disabled={!canPrev}
              tabIndex={canPrev ? 0 : -1}
              aria-label="Previous reels"
              className={cn(arrowClass, canPrev ? 'hover:bg-brand-forest hover:text-white' : 'opacity-30')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-disabled={!canNext}
              tabIndex={canNext ? 0 : -1}
              aria-label="Next reels"
              className={cn(arrowClass, canNext ? 'hover:bg-brand-forest hover:text-white' : 'opacity-30')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p className="text-center font-inter text-brand-forest/70 mb-6 md:mb-10">
          Real routines, real glow, fresh from{' '}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-forest underline decoration-brand-teal decoration-2 underline-offset-4 hover:text-brand-leaf"
          >
            @{INSTAGRAM_HANDLE}
          </a>
        </p>

        <div className="relative">
          <div className="overflow-hidden -mx-2 sm:-mx-3" ref={emblaRef}>
            <div className="flex">
              {reels.map((reel) => (
                <div
                  key={reel.shortcode}
                  className="flex-[0_0_50%] sm:flex-[0_0_33.333%] md:flex-[0_0_25%] lg:flex-[0_0_20%] px-2 sm:px-3"
                >
                  <button
                    onClick={() => setOpenReel(reel.shortcode)}
                    aria-label={`Play reel: ${reel.caption || 'Wood House Herbals on Instagram'}`}
                    className="group relative block w-full aspect-[9/16] overflow-hidden rounded-3xl bg-brand-cream shadow-md hover:shadow-xl transition-shadow duration-300 text-left"
                  >
                    <Image
                      src={reel.thumbnail}
                      alt={reel.caption || 'Wood House Herbals Instagram reel'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <Instagram
                      className="absolute top-3 right-3 h-5 w-5 text-white drop-shadow-md"
                      aria-hidden="true"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-brand-forest shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </span>
                    </span>
                    {reel.caption && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3.5 pb-3.5 pt-10">
                        <span className="block font-inter text-xs sm:text-sm text-white leading-snug line-clamp-2">
                          {reel.caption}
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              ))}

              {/* Final slide: follow CTA */}
              <div className="flex-[0_0_50%] sm:flex-[0_0_33.333%] md:flex-[0_0_25%] lg:flex-[0_0_20%] px-2 sm:px-3">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full w-full aspect-[9/16] flex-col items-center justify-center gap-4 rounded-3xl bg-brand-teal text-white shadow-md hover:shadow-xl transition-shadow duration-300 px-4 text-center"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:scale-110">
                    <Instagram className="h-7 w-7" />
                  </span>
                  <span className="font-display font-semibold text-lg leading-tight">
                    Follow us on Instagram
                  </span>
                  <span className="font-inter text-sm text-white/85">@{INSTAGRAM_HANDLE}</span>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 flex md:hidden items-center justify-center gap-3">
            <button
              onClick={scrollPrev}
              aria-disabled={!canPrev}
              tabIndex={canPrev ? 0 : -1}
              aria-label="Previous reels"
              className={cn(arrowClass, !canPrev && 'opacity-30')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-disabled={!canNext}
              tabIndex={canNext ? 0 : -1}
              aria-label="Next reels"
              className={cn(arrowClass, !canNext && 'opacity-30')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {openReel && <ReelModal shortcode={openReel} onClose={() => setOpenReel(null)} />}
    </section>
  );
}
