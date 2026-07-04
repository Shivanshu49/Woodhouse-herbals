'use client';

import { createContext, useContext } from 'react';

/**
 * Bridges the MediaSection's in-flight upload count up to the ProductForm so the
 * Publish / Save-draft buttons can be disabled while images are still uploading.
 * Without this the committed `images` array is a subset of the user's selection,
 * and submitting mid-upload would silently drop the still-uploading images.
 */
export const UploadStatusContext = createContext<{ setPendingUploads: (n: number) => void }>({
  setPendingUploads: () => {},
});

export function useUploadStatus() {
  return useContext(UploadStatusContext);
}
