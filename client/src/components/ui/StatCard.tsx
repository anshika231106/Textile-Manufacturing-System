import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { staggerItem } from '../../lib/motion';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface StatCardProps {
  icon?: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  /** Shows a small pulsing dot next to the icon chip, for "live" metrics (e.g. machines running now). */
  live?: boolean;
}

const toneStyles: Record<Tone, { chip: string; wash: string }> = {
  neutral: {
    chip: 'bg-(--color-surface-sunken) text-(--color-text-muted)',
    wash: 'from-white to-white',
  },
  accent: {
    chip: 'bg-(--color-accent-light) text-(--color-accent)',
    wash: 'from-white to-(--color-accent-light)/40',
  },
  success: {
    chip: 'bg-(--color-success-light) text-(--color-success)',
    wash: 'from-white to-(--color-success-light)/40',
  },
  warning: {
    chip: 'bg-(--color-warning-light) text-(--color-warning)',
    wash: 'from-white to-(--color-warning-light)/40',
  },
  danger: {
    chip: 'bg-(--color-danger-light) text-(--color-danger)',
    wash: 'from-white to-(--color-danger-light)/40',
  },
  info: {
    chip: 'bg-(--color-info-light) text-(--color-info)',
    wash: 'from-white to-(--color-info-light)/40',
  },
};

export function StatCard({ icon: Icon, label, value, sub, tone = 'neutral', live = false }: StatCardProps) {
  const { chip, wash } = toneStyles[tone];
  return (
    <motion.div
      variants={staggerItem}
      className={[
        'relative overflow-hidden rounded-xl border border-(--color-border) bg-gradient-to-br p-4',
        'shadow-2xs hover:shadow-xs transition-shadow duration-150',
        wash,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-(--color-text) tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-(--color-text-subtle)">{sub}</p>}
        </div>
        {Icon && (
          <span className={['relative flex items-center justify-center w-9 h-9 rounded-lg shrink-0', chip].join(' ')}>
            <Icon className="w-4.5 h-4.5" />
            {live && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-(--color-success) animate-ping" />
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
}

const columnClasses: Record<NonNullable<StatGridProps['columns']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
  6: 'grid-cols-2 lg:grid-cols-6',
};

export function StatGrid({ children, columns = 4 }: StatGridProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
      className={['grid gap-4', columnClasses[columns]].join(' ')}
    >
      {children}
    </motion.div>
  );
}
