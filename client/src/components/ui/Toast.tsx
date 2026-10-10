import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toastVariants, transitionSnappy } from '../../lib/motion';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE_TOASTS = 4;

let counter = 0;

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircleIcon className="w-5 h-5 text-(--color-success)" />,
  error:   <ExclamationCircleIcon className="w-5 h-5 text-(--color-danger)" />,
  info:    <InformationCircleIcon className="w-5 h-5 text-(--color-info)" />,
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitionSnappy}
      className="flex items-start gap-3 min-w-[300px] max-w-sm bg-white border border-(--color-border) rounded-xl shadow-lg px-4 py-3"
    >
      <span className="shrink-0 mt-0.5">{icons[item.variant]}</span>
      <p className="flex-1 text-sm text-(--color-text) leading-snug">{item.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-(--color-text-muted) hover:text-(--color-text) transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++counter;
    setToasts((prev) => {
      const next = [...prev, { id, message, variant }];
      // Cap visible toasts - drop the oldest once we're over the limit.
      return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next;
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast portal */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// Re-exported for convenience
export { ToastContext };
export type { ToastVariant };
