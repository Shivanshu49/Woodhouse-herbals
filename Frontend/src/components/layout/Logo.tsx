import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Wood House wordmark.
 *
 * Recreates the brand logo: the words "wood" and "house" set in our display
 * font (Fraunces) in deep navy, with the "oo" in "wood" rendered as a single
 * continuous vibrant-green infinity ring — the same motif as the printed logo.
 *
 * Variants:
 *   - default (stacked, packaging-style)
 *   - compact (single line, navbar-style)
 *   - light   (cream letters for use on dark surfaces — footer, hero overlays)
 */
export function Logo({
  className,
  compact = false,
  light = false,
}: {
  className?: string;
  compact?: boolean;
  light?: boolean;
}) {
  const letterColor = light ? 'text-cream' : 'text-navy-900';
  return (
    <Link
      href="/"
      aria-label="Wood House Herbals home"
      className={cn('inline-flex items-center gap-2 group', className)}
    >
      <span className={cn('font-display font-bold leading-none tracking-tight flex items-baseline', letterColor)}>
        {compact ? (
          <span className="inline-flex items-baseline text-[26px] sm:text-[28px]">
            <span>w</span>
            <InfinityOO className="mx-[1px] h-[20px] sm:h-[22px] w-auto -translate-y-[2px]" />
            <span>d</span>
            <span className="ml-2 text-navy-900/85">house</span>
          </span>
        ) : (
          <span className="flex flex-col">
            <span className="inline-flex items-baseline text-[28px] sm:text-[34px]">
              <span>w</span>
              <InfinityOO className="mx-[1px] h-[22px] sm:h-[26px] w-auto -translate-y-[2px]" />
              <span>d</span>
            </span>
            <span className="text-[28px] sm:text-[34px] -mt-1.5">house</span>
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * The signature "oo" — two circles fused into a continuous infinity ring,
 * stroked in the brand green. Vector-based so it scales cleanly with the
 * surrounding letterforms.
 */
function InfinityOO({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="#7AC143" strokeWidth="4.5" />
      <circle cx="36" cy="12" r="9" stroke="#7AC143" strokeWidth="4.5" />
    </svg>
  );
}
