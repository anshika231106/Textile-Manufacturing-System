import type { ReactNode } from 'react';
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent';

export interface CalloutProps {
  tone?: Tone;
  title?: string;
  icon?: React.ElementType;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-(--color-surface-sunken) border-(--color-border) text-(--color-text-muted)',
  info: 'bg-(--color-info-light) border-(--color-info-border) text-(--color-info)',
  warning: 'bg-(--color-warning-light) border-(--color-warning-border) text-(--color-warning)',
  success: 'bg-(--color-success-light) border-(--color-success-border) text-(--color-success)',
  danger: 'bg-(--color-danger-light) border-(--color-danger-border) text-(--color-danger)',
  accent: 'bg-(--color-accent-light) border-(--color-accent)/25 text-(--color-accent-hover)',
};

const defaultIcons: Record<Tone, React.ElementType> = {
  neutral: InformationCircleIcon,
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
  success: CheckCircleIcon,
  danger: ExclamationCircleIcon,
  accent: SparklesIcon,
};

export function Callout({ tone = 'neutral', title, icon, children, className = '' }: CalloutProps) {
  const Icon = icon ?? defaultIcons[tone];
  return (
    <div className={['flex gap-3 rounded-xl border p-3.5', toneClasses[tone], className].join(' ')}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm text-(--color-text)">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-[13px] leading-relaxed text-(--color-text-muted)">{children}</div>
      </div>
    </div>
  );
}
