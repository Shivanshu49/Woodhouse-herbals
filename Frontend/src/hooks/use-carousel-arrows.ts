'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UseEmblaCarouselType } from 'embla-carousel-react';

type EmblaApi = UseEmblaCarouselType[1];

/**
 * Prev/next arrow state + guarded scroll handlers for an embla carousel,
 * shared by every homepage slider so the wiring can't drift.
 *
 * Both directions start disabled: the server-rendered HTML must never paint
 * an active arrow for a carousel that can't scroll (e.g. four bestseller
 * cards in a four-per-view row) — the first update after embla initialises
 * reveals whichever ends actually apply.
 */
export function useCarouselArrows(emblaApi: EmblaApi) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

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

  const scrollPrev = useCallback(() => {
    if (canPrev) emblaApi?.scrollPrev();
  }, [canPrev, emblaApi]);
  const scrollNext = useCallback(() => {
    if (canNext) emblaApi?.scrollNext();
  }, [canNext, emblaApi]);

  return { canPrev, canNext, scrollPrev, scrollNext };
}
