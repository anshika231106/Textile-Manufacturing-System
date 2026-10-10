import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-(--color-accent) text-white shadow-sm hover:bg-(--color-accent-hover) hover:shadow-md active:scale-[0.98] focus-visible:ring-(--color-accent)',
  secondary:
    'bg-white text-(--color-text) border border-(--color-border) hover:bg-(--color-accent-light) hover:border-(--color-accent)/40 active:scale-[0.98] focus-visible:ring-(--color-accent)',
  ghost:
    'text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-sunken) active:scale-[0.98] focus-visible:ring-(--color-accent)',
  danger:
    'bg-(--color-danger) text-white shadow-sm hover:bg-[#B91C1C] hover:shadow-md active:scale-[0.98] focus-visible:ring-(--color-danger)',
};

const sizes: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-sm',
  md:  'px-4 py-2 text-sm',
  lg:  'px-5 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner size="sm" inherit />}
      {children}
    </button>
  );
}
