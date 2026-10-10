import type { Transition, Variants } from 'framer-motion';

// Shared Framer Motion presets. Keep the number of distinct timings/easings small
// so motion feels consistent across the app instead of bespoke per component.

/** Quick, snappy transition for small UI elements (dialogs, toasts, pills). */
export const transitionSnappy: Transition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
};

/** Slightly slower transition for larger surfaces (page content, panels). */
export const transitionSmooth: Transition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
};

/** Spring used for the shared sliding active-indicator (Nav, SegmentedControl). */
export const springIndicator: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
};

export const fadeScaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const toastVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 40, transition: { duration: 0.15 } },
};

/** Stagger container for grids of stat tiles / list items entering together. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};
