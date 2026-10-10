import { useId } from 'react';
import { motion } from 'framer-motion';
import { springIndicator } from '../../lib/motion';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
type Size = 'sm' | 'md';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
  tone?: Tone;
  description?: string;
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: Size;
  fullWidth?: boolean;
  /** Options that should render disabled (e.g. the already-active status in a self-status toggle). */
  disabledOptions?: T[];
}

const activeToneClasses: Record<Tone, string> = {
  neutral: 'text-(--color-text)',
  accent: 'text-(--color-accent)',
  success: 'text-(--color-success)',
  warning: 'text-(--color-warning)',
  danger: 'text-(--color-danger)',
};

const activePillToneClasses: Record<Tone, string> = {
  neutral: 'bg-white border border-(--color-border)',
  accent: 'bg-(--color-accent-light) border border-(--color-accent)/25',
  success: 'bg-(--color-success-light) border border-(--color-success-border)',
  warning: 'bg-(--color-warning-light) border border-(--color-warning-border)',
  danger: 'bg-(--color-danger-light) border border-(--color-danger-border)',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  disabledOptions = [],
}: SegmentedControlProps<T>) {
  const uid = useId();

  return (
    <div
      role="tablist"
      className={[
        'inline-flex items-stretch gap-1 rounded-lg border border-(--color-border) bg-(--color-surface-sunken) p-1',
        fullWidth ? 'grid' : 'flex flex-wrap',
      ].join(' ')}
      style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = disabledOptions.includes(option.value);
        const tone = option.tone ?? 'accent';
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(option.value)}
            className={[
              'relative z-0 flex flex-col items-center justify-center gap-0.5 rounded-md font-medium transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sizeClasses[size],
              isActive ? activeToneClasses[tone] : 'text-(--color-text-muted) hover:text-(--color-text)',
            ].join(' ')}
          >
            {isActive && (
              <motion.span
                layoutId={`segmented-pill-${uid}`}
                className={['absolute inset-0 rounded-md shadow-sm', activePillToneClasses[tone]].join(' ')}
                transition={springIndicator}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className="w-4 h-4" />}
              {option.label}
              {typeof option.count === 'number' && (
                <span className="text-[10px] font-semibold opacity-70 tabular-nums">({option.count})</span>
              )}
            </span>
            {option.description && (
              <span className="relative z-10 text-[11px] font-normal opacity-75">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
