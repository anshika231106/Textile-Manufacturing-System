import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type Tone = 'accent' | 'success' | 'warning' | 'danger';
type Size = 'sm' | 'md';

export interface ProgressBarProps {
  /** 0-100. Caller is responsible for clamping/rounding before passing it in. */
  value: number;
  tone?: Tone;
  size?: Size;
  label?: ReactNode;
}

const fillClasses: Record<Tone, string> = {
  accent: 'bg-(--color-accent)',
  success: 'bg-(--color-success)',
  warning: 'bg-(--color-warning)',
  danger: 'bg-(--color-danger)',
};

const trackSize: Record<Size, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

export function ProgressBar({ value, tone = 'accent', size = 'sm', label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && <div className="mb-1.5 text-xs text-(--color-text-muted)">{label}</div>}
      <div className={['w-full rounded-full bg-(--color-surface-sunken) overflow-hidden', trackSize[size]].join(' ')}>
        <motion.div
          className={['h-full rounded-full', fillClasses[tone]].join(' ')}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
