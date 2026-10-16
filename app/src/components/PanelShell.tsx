import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cls } from '../lib/util';

/** Overlay over the dimmed desk. `screen` drives data-screen + the `<screen>.close` testid. */
export function PanelShell({
  screen,
  children,
  className,
  onClose,
  unroll = 'none',
  closeLabel = '收起',
}: {
  screen: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  unroll?: 'none' | 'vertical' | 'horizontal';
  closeLabel?: string;
}) {
  const initial =
    unroll === 'horizontal'
      ? { clipPath: 'inset(0 46% 0 46%)', opacity: 0.4 }
      : unroll === 'vertical'
        ? { clipPath: 'inset(0 0 92% 0)', opacity: 0.4 }
        : { opacity: 0, scale: 0.97, y: 10 };
  const animate =
    unroll === 'none' ? { opacity: 1, scale: 1, y: 0 } : { clipPath: 'inset(0 0% 0 0%)', opacity: 1 };
  return (
    <motion.div
      className="overlay"
      data-screen={screen}
      data-testid={`${screen}.root`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <motion.div
        className={cls('panel', `panel--${screen}`, className)}
        initial={initial}
        animate={animate}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
        transition={{ duration: unroll === 'none' ? 0.32 : 0.7, ease: [0.22, 0.8, 0.24, 1] }}
      >
        {onClose && (
          <button className="close-btn" data-testid={`${screen}.close`} onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}
