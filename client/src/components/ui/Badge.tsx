type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: Variant;
  label: string;
  dot?: boolean;
}

const styles: Record<Variant, string> = {
  success: 'bg-(--color-success-light) text-(--color-success) border-(--color-success-border)',
  warning: 'bg-(--color-warning-light) text-(--color-warning) border-(--color-warning-border)',
  danger:  'bg-(--color-danger-light) text-(--color-danger) border-(--color-danger-border)',
  info:    'bg-(--color-info-light) text-(--color-info) border-(--color-info-border)',
  neutral: 'bg-(--color-surface-sunken) text-(--color-text-muted) border-(--color-border)',
};

const dotColors: Record<Variant, string> = {
  success: 'bg-(--color-success)',
  warning: 'bg-(--color-warning)',
  danger:  'bg-(--color-danger)',
  info:    'bg-(--color-info)',
  neutral: 'bg-(--color-text-muted)',
};

export function Badge({ variant = 'neutral', label, dot = false }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors duration-150',
        styles[variant],
      ].join(' ')}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {label}
    </span>
  );
}
