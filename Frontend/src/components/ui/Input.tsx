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
        'h-12 w-full rounded-full border bg-white px-5 text-[15px] text-ink placeholder:text-ink-subtle transition-colors',
        'border-navy-900/15 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none',
        invalid && 'border-blush focus:ring-blush/30',
        className,
      )}
      {...rest}
    />
  );
});
