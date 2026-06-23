'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import type { ProductImage } from '@/types';

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0);
  const safe = images.length > 0 ? images : [{ url: '', alt: '' }];
  const current = safe[active] ?? safe[0];

  return (
    <div className="flex flex-col sm:flex-row-reverse gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-cream via-white to-brand-500/8 flex-1 ring-1 ring-navy-900/5 shadow-soft">
        <div className="absolute inset-0 bg-dot-grid opacity-50" aria-hidden="true" />
        {current.url && (
          <Image
            src={current.url}
            alt={current.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      {safe.length > 1 && (
        <div className="flex sm:flex-col gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible no-scrollbar">
          {safe.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setActive(i)}
              className={cn(
                'relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border transition-all',
                i === active
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : 'border-navy-900/10 hover:border-brand-500/50',
              )}
              aria-label={`Show image ${i + 1}`}
            >
              {img.url && <Image src={img.url} alt={img.alt} fill sizes="80px" className="object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
