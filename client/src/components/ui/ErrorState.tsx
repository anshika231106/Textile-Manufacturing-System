import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

// Map API error codes to readable user-facing messages
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED:        'Your session has expired. Please log in again.',
  FORBIDDEN:           "You don't have permission to perform this action.",
  NOT_FOUND:           'The requested resource was not found.',
  VALIDATION_ERROR:    'Some inputs are invalid. Please check and try again.',
  INSUFFICIENT_YARN:   'There is not enough yarn stock to fulfil this request.',
  ALREADY_STARTED:     'Production has already been started for this order.',
  UNKNOWN_ERROR:       'Something went wrong. Please try again.',
};

interface ErrorStateProps {
  message?: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, code, onRetry }: ErrorStateProps) {
  const display =
    (code && ERROR_MESSAGES[code]) ?? message ?? 'An unexpected error occurred.';

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626]">
        <ExclamationTriangleIcon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1A1714]">Something went wrong</p>
        <p className="mt-1 text-sm text-[#78716C]">{display}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <ArrowPathIcon className="w-4 h-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
