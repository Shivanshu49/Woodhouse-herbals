'use client';

import { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { relativeTime, absoluteTime } from '@/lib/order-date';

/** Relative time in the cell, full timestamp on hover. Computed client-side. */
export function RelativeDate({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-sm text-muted-foreground">
            {relativeTime(iso, now)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{absoluteTime(iso)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
