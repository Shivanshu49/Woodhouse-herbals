import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-full border bg-white/90 px-4 text-[15px] text-ink placeholder:text-ink-subtle',
        'border-forest-900/15 focus:border-forest-900 focus:ring-2 focus:ring-forest-500/30 focus:outline-none',
        invalid && 'border-clay-300 focus:ring-clay-300/30',
        className,
      )}
      {...rest}
    />
  );
});
