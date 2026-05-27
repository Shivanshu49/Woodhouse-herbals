import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'clay';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-forest-900 text-cream hover:bg-forest-800 shadow-soft hover:shadow-lift',
  secondary:
    'bg-cream text-forest-900 border border-forest-900/10 hover:border-forest-900/20 hover:bg-sand-100 shadow-soft',
  ghost: 'text-forest-900 hover:bg-forest-900/5',
  outline:
    'border border-forest-900 text-forest-900 hover:bg-forest-900 hover:text-cream',
  clay: 'bg-clay-300 text-white hover:bg-clay-400 shadow-soft',
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
