import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2 group', className)} aria-label="Wood House Herbals home">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-forest-900 text-cream">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c4.5 4 7 8 7 12a7 7 0 1 1-14 0c0-4 2.5-8 7-12z" />
          <path d="M12 9v12" />
          <path d="M9 14c1.5-1 4-1 6 0" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg sm:text-xl text-forest-900 tracking-tight">Wood House</span>
          <span className="text-[10px] uppercase tracking-[0.28em] text-ink-muted">Herbals</span>
        </span>
      )}
    </Link>
  );
}
