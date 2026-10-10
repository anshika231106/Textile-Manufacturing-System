import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';

// Framer Motion's motion.div redefines a few event handlers (drag/animation) with its own
// signatures, which conflict with the plain DOM ones - omit them since no Card caller uses them.
type SafeDivAttributes = Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'>;

interface CardProps extends SafeDivAttributes {
  children: ReactNode;
  /** Adds a hover lift + pointer cursor, for cards that act as clickable entities (e.g. machine cards). */
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false, ...props }: CardProps) {
  const base = 'bg-white border border-(--color-border) rounded-xl shadow-sm';

  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className={[base, 'cursor-pointer hover:shadow-md transition-shadow', className].join(' ')}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={[base, className].join(' ')} {...props}>
      {children}
    </div>
  );
}
