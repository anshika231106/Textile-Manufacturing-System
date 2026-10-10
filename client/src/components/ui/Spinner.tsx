type Size = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: Size;
  /** Use currentColor instead of the accent token - for spinners on colored backgrounds (e.g. buttons). */
  inherit?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', inherit = false }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block rounded-full border-t-transparent animate-spin',
        inherit ? 'border-current' : 'border-(--color-accent)',
        sizeStyles[size],
      ].join(' ')}
    />
  );
}
