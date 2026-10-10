type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: Variant;
  label: string;
  dot?: boolean;
}

const styles: Record<Variant, string> = {
  success: 'bg-[#F0FDF4] text-[#16A34A] border-[#86EFAC]',
  warning: 'bg-[#FFFBEB] text-[#D97706] border-[#FCD34D]',
  danger:  'bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]',
  info:    'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  neutral: 'bg-[#F5F4F2] text-[#78716C] border-[#E8E4DF]',
};

const dotColors: Record<Variant, string> = {
  success: 'bg-[#16A34A]',
  warning: 'bg-[#D97706]',
  danger:  'bg-[#DC2626]',
  info:    'bg-[#2563EB]',
  neutral: 'bg-[#78716C]',
};

export function Badge({ variant = 'neutral', label, dot = false }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap',
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
