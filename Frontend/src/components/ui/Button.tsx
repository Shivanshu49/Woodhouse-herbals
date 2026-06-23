import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'navy' | 'accent';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

const variantClasses: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 shadow-soft hover:shadow-glow',
  navy:      'bg-navy-900 text-cream hover:bg-navy-800 shadow-soft hover:shadow-lift',
  secondary: 'bg-cream text-navy-900 border border-navy-900/10 hover:border-navy-900/20 hover:bg-cream-200 shadow-soft',
  ghost:     'text-navy-900 hover:bg-brand-500/10',
  outline:   'border-2 border-brand-500 text-brand-700 hover:bg-brand-500 hover:text-white',
  accent:    'bg-citrus text-navy-900 hover:bg-citrus-600 hover:text-white shadow-soft',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, children, iconLeft, iconRight, loading, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  );
});
