import type { ReactNode } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#F5F4F2] text-[#78716C]">
        {icon ?? <InboxIcon className="w-6 h-6" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1A1714]">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-[#78716C]">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
