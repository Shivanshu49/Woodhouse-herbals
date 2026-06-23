import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-white border border-navy-900/5 shadow-soft overflow-hidden',
        className,
      )}
      {...rest}
    />
  );
}
