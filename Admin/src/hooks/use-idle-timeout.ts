'use client';

import { useEffect, useRef } from 'react';

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/** The absolute time (ms epoch) at which the session goes idle. Pure. */
export function nextDeadline(now: number, timeoutMs: number): number {
  return now + timeoutMs;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Calls `onIdle` after `timeoutMs` of no user activity. Any pointer/keyboard
 * activity, or the tab becoming visible, resets the timer. Activity is
 * throttled so a burst of events doesn't reset on every frame.
 */
export function useIdleTimeout({
  timeoutMs,
  onIdle,
}: {
  timeoutMs: number;
  onIdle: () => void;
}) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastReset = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return; // throttle
      lastReset = now;
      arm();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm();
    };

    arm();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timeoutMs]);
}
