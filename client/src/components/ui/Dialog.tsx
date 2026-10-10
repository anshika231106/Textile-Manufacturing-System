import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { transitionSnappy } from '../../lib/motion';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Dialog({ open, onClose, title, children, width = 'max-w-md' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionSnappy}
        >
          <motion.div
            className={[
              'relative w-full bg-white rounded-2xl shadow-xl overflow-hidden',
              width,
            ].join(' ')}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={transitionSnappy}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border)">
              <h2 className="text-base font-semibold text-(--color-text)">{title}</h2>
              <button
                onClick={onClose}
                className="text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-sunken) transition-colors rounded-md p-1"
                aria-label="Close dialog"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
