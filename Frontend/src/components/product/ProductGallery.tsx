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
      <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-sand-100/60 flex-1">
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
                  ? 'border-forest-900 ring-2 ring-forest-900/20'
                  : 'border-forest-900/10 hover:border-forest-900/30',
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
