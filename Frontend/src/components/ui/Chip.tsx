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
    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'border-brand-500 bg-brand-500 text-white shadow-soft'
      : 'border-navy-900/12 bg-white text-navy-900 hover:border-brand-500 hover:bg-brand-500/8',
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
