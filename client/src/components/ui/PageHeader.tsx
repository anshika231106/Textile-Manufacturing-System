import type { ReactNode } from 'react';
import { Badge } from './Badge';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: { label: string; tone?: BadgeTone };
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-(--color-border)">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">{title}</h1>
          {badge && <Badge variant={badge.tone ?? 'neutral'} label={badge.label} dot />}
        </div>
        {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
