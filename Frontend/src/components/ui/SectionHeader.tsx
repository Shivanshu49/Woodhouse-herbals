import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  align = 'left',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 sm:mb-10 lg:mb-12 flex flex-col gap-3',
        align === 'center' && 'items-center text-center',
        ctaHref && 'sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className={cn('max-w-2xl flex flex-col gap-3', align === 'center' && 'items-center text-center')}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="text-display-md text-balance">{title}</h2>
        {subtitle && <p className="text-ink-muted text-base sm:text-lg max-w-prose text-balance">{subtitle}</p>}
      </div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-forest-900 hover:text-forest-700 group whitespace-nowrap"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
