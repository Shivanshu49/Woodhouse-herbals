import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface RatingProps {
  value: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
}

export function Rating({ value, reviewCount, size = 'sm', showCount = true, className }: RatingProps) {
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div className={cn('inline-flex items-center gap-1.5 text-ink-muted', className)}>
      <div className="inline-flex items-center" aria-label={`Rated ${value} of 5`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = value >= i + 1;
          const half = !filled && value > i + 0.25 && value < i + 0.75;
          return (
            <Star
              key={i}
              className={cn(
                starSize,
                filled || half ? 'text-clay-300 fill-clay-300' : 'text-ink-subtle/40',
              )}
              strokeWidth={1.5}
            />
          );
        })}
      </div>
      {showCount && (
        <span className="text-xs font-medium text-ink-muted">
          {value.toFixed(1)}
          {reviewCount !== undefined ? ` · ${reviewCount.toLocaleString('en-IN')}` : ''}
        </span>
      )}
    </div>
  );
}
