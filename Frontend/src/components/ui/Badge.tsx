import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'bestseller' | 'new' | 'sale' | 'limited' | 'neutral';

export interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  bestseller: 'bg-forest-900 text-cream',
  new: 'bg-sage-300 text-forest-900',
  sale: 'bg-clay-300 text-white',
  limited: 'bg-ink text-cream',
  neutral: 'bg-cream-200 text-forest-900 border border-forest-900/10',
};

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
