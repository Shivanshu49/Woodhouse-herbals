'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { cloudinaryThumb } from '@/lib/cloudinary';

/**
 * Small square product thumbnail. Applies a Cloudinary card transform when the
 * source is a Cloudinary URL, and falls back to a placeholder tile both when
 * there is no image and when the image fails to load. Rendered as a plain
 * <img> (not next/image) so a broken remote URL degrades gracefully to the
 * placeholder rather than throwing in the optimizer.
 */
export function ProductThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : cloudinaryThumb(url, 96);

  if (!src) {
    return (
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={40}
      height={40}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 rounded-md border bg-muted object-cover"
    />
  );
}
