type Size = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: Size;
}

const sizeStyles: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block rounded-full border-[#EA580C] border-t-transparent',
        sizeStyles[size],
      ].join(' ')}
      style={{ animation: 'spin 0.7s linear infinite' }}
    />
  );
}
