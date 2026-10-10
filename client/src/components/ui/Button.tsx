import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
    'bg-[#EA580C] text-white hover:bg-[#C2410C] active:scale-[0.98] focus-visible:ring-[#EA580C]',
  secondary:
    'bg-white text-[#1A1714] border border-[#E8E4DF] hover:bg-[#FFF7ED] hover:border-[#EA580C]/40 active:scale-[0.98] focus-visible:ring-[#EA580C]',
  ghost:
    'text-[#78716C] hover:text-[#1A1714] hover:bg-[#F5F4F2] active:scale-[0.98] focus-visible:ring-[#EA580C]',
  danger:
    'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98] focus-visible:ring-[#DC2626]',
};

const sizes: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-sm',
  md:  'px-4 py-2 text-sm',
  lg:  'px-5 py-2.5 text-base',
};

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
      style={{ animation: 'spin 0.7s linear infinite' }}
      aria-hidden
    />
  );
}

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
      {loading && <Spinner />}
      {children}
    </button>
  );
}
