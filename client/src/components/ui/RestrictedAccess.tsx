import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { Callout } from './Callout';

export interface RestrictedAccessProps {
  message?: string;
  icon?: React.ElementType;
  className?: string;
}

export function RestrictedAccess({
  message = "You don't have permission to perform this action.",
  icon = ShieldExclamationIcon,
  className,
}: RestrictedAccessProps) {
  return (
    <Callout tone="warning" title="Access Restricted" icon={icon} className={className}>
      {message}
    </Callout>
  );
}
