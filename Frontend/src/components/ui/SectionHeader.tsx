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
        'mb-6 sm:mb-10 lg:mb-14 flex flex-col gap-3',
        align === 'center' && 'items-center text-center',
        ctaHref && 'sm:flex-row sm:items-end sm:justify-between sm:gap-8',
        className,
      )}
    >
      <div className={cn('max-w-2xl flex flex-col gap-3', align === 'center' && 'items-center text-center')}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="text-display-lg text-balance">{title}</h2>
        {subtitle && (
          <p className="text-ink-muted text-base sm:text-lg max-w-prose text-balance leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-navy-900/10 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-500/5 transition-colors group whitespace-nowrap shadow-soft"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
