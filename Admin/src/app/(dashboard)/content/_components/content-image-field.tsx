'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';

/** Signed Cloudinary upload for a content image. `folder` scopes the asset to
 *  woodhouse/banners or woodhouse/content (see the backend DeleteUploadDto). */
export function ContentImageField({
  value,
  onChange,
  folder,
  aspect = 'square',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: 'banners' | 'content';
  aspect?: 'square' | 'wide';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const box = aspect === 'wide' ? 'h-16 w-28' : 'h-16 w-16';

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const sign = await api.uploads.sign(folder);
      const uploaded = await uploadToCloudinary(file, sign);
      onChange(uploaded.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={`${box} rounded object-cover`} />
      ) : (
        <div className={`${box} flex items-center justify-center rounded bg-muted text-xs text-muted-foreground`}>
          No image
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
