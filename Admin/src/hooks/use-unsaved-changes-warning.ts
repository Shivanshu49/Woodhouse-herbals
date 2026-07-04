'use client';

import { useEffect } from 'react';

/**
 * Warn before leaving with unsaved changes. Covers browser-level navigation
 * (refresh, tab close, address-bar change) via `beforeunload`. In-app Link
 * navigation guarding is a separate concern tracked as a follow-up.
 */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy requirement for the native prompt to show.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
