import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '../ui/Button';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-(--color-bg) p-6">
          <div className="w-full max-w-lg bg-white border border-(--color-border) rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-(--color-danger-light) flex items-center justify-center text-(--color-danger)">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-(--color-text)">Something went wrong</h2>
              <p className="text-xs text-(--color-text-muted) mt-1">
                An unexpected interface error occurred.
              </p>
            </div>
            {this.state.error && (
              <div className="w-full p-3 rounded-xl bg-(--color-bg) border border-(--color-border) text-left text-xs font-mono text-(--color-danger) overflow-x-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  window.location.href = '/orders';
                }}
              >
                Go to Orders
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                <ArrowPathIcon className="w-4 h-4 mr-1.5" />
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
