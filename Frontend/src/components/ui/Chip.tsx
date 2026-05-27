import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  as?: 'button' | 'span';
}

export function Chip({ active = false, onClick, className, children, as = 'button' }: ChipProps) {
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
    active
      ? 'border-forest-900 bg-forest-900 text-cream'
      : 'border-forest-900/15 bg-white/70 text-forest-900 hover:border-forest-900/40 hover:bg-white',
    className,
  );
  if (as === 'span') {
    return <span className={cls}>{children}</span>;
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {children}
    </button>
  );
}
