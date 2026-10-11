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
  /** Makes the card a button, e.g. to open a breakdown of the figure. */
  onClick?: () => void;
}

const toneStyles: Record<Tone, { chip: string; wash: string }> = {
  neutral: {
    chip: 'bg-(--color-surface-sunken) text-(--color-text-muted)',
    wash: 'from-(--color-surface) to-(--color-surface)',
  },
  accent: {
    chip: 'bg-(--color-accent-light) text-(--color-accent)',
    wash: 'from-(--color-surface) to-(--color-accent-light)/40',
  },
  success: {
    chip: 'bg-(--color-success-light) text-(--color-success)',
    wash: 'from-(--color-surface) to-(--color-success-light)/40',
  },
  warning: {
    chip: 'bg-(--color-warning-light) text-(--color-warning)',
    wash: 'from-(--color-surface) to-(--color-warning-light)/40',
  },
  danger: {
    chip: 'bg-(--color-danger-light) text-(--color-danger)',
    wash: 'from-(--color-surface) to-(--color-danger-light)/40',
  },
  info: {
    chip: 'bg-(--color-info-light) text-(--color-info)',
    wash: 'from-(--color-surface) to-(--color-info-light)/40',
  },
};

export function StatCard({ icon: Icon, label, value, sub, tone = 'neutral', live = false, onClick }: StatCardProps) {
  const { chip, wash } = toneStyles[tone];
  return (
    <motion.div
      variants={staggerItem}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={[
        'relative overflow-hidden rounded-xl border border-(--color-border) bg-gradient-to-br p-4',
        'shadow-2xs hover:shadow-xs transition-shadow duration-150',
        onClick
          ? 'cursor-pointer hover:border-(--color-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)'
          : '',
        wash,
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted) truncate">{label}</p>
        {Icon && (
          <span className={['relative flex items-center justify-center w-8 h-8 rounded-lg shrink-0', chip].join(' ')}>
            <Icon className="w-4 h-4" />
            {live && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-(--color-success) animate-ping" />
            )}
          </span>
        )}
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-(--color-text) tabular-nums tracking-tight whitespace-nowrap truncate">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-(--color-text-subtle) truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

export interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
}

const columnClasses: Record<NonNullable<StatGridProps['columns']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-6',
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
