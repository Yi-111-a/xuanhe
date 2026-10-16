import type { CSSProperties, ReactNode } from 'react';
import { cls, deckle } from '../lib/util';

/** Paper/silk sheet with deckled edges and an ink-wash vignette. */
export function Paper({
  children,
  variant = 'paper',
  seed = 7,
  amp = 4,
  className,
  style,
  innerClassName,
  testid,
  sides = 'all',
}: {
  children?: ReactNode;
  variant?: 'paper' | 'silk' | 'edict' | 'slip';
  seed?: number;
  amp?: number;
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
  testid?: string;
  sides?: 'all' | 'lr' | 'tb';
}) {
  return (
    <div className={cls('paper-wrap', className)} style={style} data-testid={testid}>
      <div
        className={cls('paper', variant !== 'paper' && `paper--${variant}`, innerClassName)}
        style={{ clipPath: deckle(seed, amp, 40, sides), height: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Wooden roller with gilt end caps (scroll ends). */
export function Roller({ orientation = 'vertical', length = '100%', thickness = 26 }: { orientation?: 'vertical' | 'horizontal'; length?: string | number; thickness?: number }) {
  const vertical = orientation === 'vertical';
  return (
    <div
      className={cls('roller', vertical ? 'roller--v' : 'roller--h')}
      style={vertical ? { width: thickness, height: length } : { height: thickness, width: length }}
      aria-hidden="true"
    >
      <span className="roller-cap roller-cap--a" />
      <span className="roller-cap roller-cap--b" />
    </div>
  );
}
