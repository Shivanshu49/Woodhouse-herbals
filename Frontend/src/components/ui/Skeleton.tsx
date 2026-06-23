import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-cream-200/70 relative overflow-hidden',
        className,
      )}
    >
      <span className="absolute inset-0 shimmer animate-shimmer" />
    </div>
  );
}
