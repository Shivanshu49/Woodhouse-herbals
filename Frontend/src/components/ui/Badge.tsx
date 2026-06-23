import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'bestseller' | 'new' | 'sale' | 'limited' | 'neutral' | 'soft';

export interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  bestseller: 'bg-navy-900 text-cream',
  new:        'bg-brand-500 text-white',
  sale:       'bg-blush text-white',
  limited:    'bg-citrus text-navy-900',
  neutral:    'bg-cream-200 text-navy-900 border border-navy-900/10',
  soft:       'bg-brand-500/12 text-brand-700',
};

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
