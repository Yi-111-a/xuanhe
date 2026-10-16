// Tang ornament vocabulary drawn as SVG: 宝相花 rosettes, 卷草纹 vine bands, 联珠 pearl rows.
import { useId } from 'react';

export function Baoxiang({ size = 40, color = 'var(--nijin)', inner = 'var(--zhusha)', className }: { size?: number; color?: string; inner?: string; className?: string }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg className={className} width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      {petals.map((a) => (
        <path
          key={`o${a}`}
          transform={`rotate(${a})`}
          d="M0 -12 C 10 -18, 16 -34, 0 -47 C -16 -34, -10 -18, 0 -12 Z"
          fill={color}
          opacity={0.92}
          stroke="rgba(60,30,10,.55)"
          strokeWidth={1.2}
        />
      ))}
      {petals.map((a) => (
        <path
          key={`i${a}`}
          transform={`rotate(${a + 22.5})`}
          d="M0 -10 C 6 -14, 9 -24, 0 -31 C -9 -24, -6 -14, 0 -10 Z"
          fill={inner}
          opacity={0.85}
          stroke="rgba(60,20,10,.45)"
          strokeWidth={1}
        />
      ))}
      <circle r={11} fill={color} stroke="rgba(60,30,10,.6)" strokeWidth={1.4} />
      <circle r={5} fill={inner} />
      {petals.map((a) => (
        <circle key={`d${a}`} transform={`rotate(${a}) translate(0 -8)`} r={1.6} fill="rgba(60,30,10,.6)" />
      ))}
    </svg>
  );
}

/** Horizontal scrolling-vine band, tiles to any width. */
export function CuancaoBand({ height = 22, color = 'var(--nijin)', bg = 'transparent', className }: { height?: number; color?: string; bg?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={`cc${id}`} width={56} height={22} patternUnits="userSpaceOnUse" patternTransform={`scale(${height / 22})`}>
          <rect width={56} height={22} fill={bg} />
          <path d="M0 11 C 9 1, 19 1, 28 11 S 47 21, 56 11" fill="none" stroke={color} strokeWidth={1.6} />
          <path d="M14 5.5 c 4 -3, 8 0, 6 3.5 c -1.5 2.5, -5 1.5, -4 -1" fill="none" stroke={color} strokeWidth={1.3} />
          <path d="M42 16.5 c -4 3, -8 0, -6 -3.5 c 1.5 -2.5, 5 -1.5, 4 1" fill="none" stroke={color} strokeWidth={1.3} />
          <circle cx={28} cy={11} r={1.6} fill={color} />
          <line x1={0} y1={0.8} x2={56} y2={0.8} stroke={color} strokeWidth={0.8} opacity={0.7} />
          <line x1={0} y1={21.2} x2={56} y2={21.2} stroke={color} strokeWidth={0.8} opacity={0.7} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#cc${id})`} />
    </svg>
  );
}

/** Vertical vine band for scroll borders. */
export function CuancaoColumn({ width = 22, color = 'var(--nijin)', bg = 'transparent', className }: { width?: number; color?: string; bg?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width={width} height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={`cv${id}`} width={22} height={56} patternUnits="userSpaceOnUse" patternTransform={`scale(${width / 22})`}>
          <rect width={22} height={56} fill={bg} />
          <path d="M11 0 C 1 9, 1 19, 11 28 S 21 47, 11 56" fill="none" stroke={color} strokeWidth={1.6} />
          <path d="M5.5 14 c -3 4, 0 8, 3.5 6 c 2.5 -1.5, 1.5 -5, -1 -4" fill="none" stroke={color} strokeWidth={1.3} />
          <path d="M16.5 42 c 3 -4, 0 -8, -3.5 -6 c -2.5 1.5, -1.5 5, 1 4" fill="none" stroke={color} strokeWidth={1.3} />
          <circle cx={11} cy={28} r={1.6} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#cv${id})`} />
    </svg>
  );
}

/** Pearl roundel row (联珠纹). */
export function PearlRow({ count = 9, color = 'var(--nijin)', size = 6 }: { count?: number; color?: string; size?: number }) {
  return (
    <svg width={count * size * 1.8} height={size * 1.6} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={size * 0.9 + i * size * 1.8} cy={size * 0.8} r={size / 2} fill={color} stroke="rgba(40,20,5,.5)" strokeWidth={0.8} />
      ))}
    </svg>
  );
}

/** Corner flourish for lacquer/brocade frames. */
export function CornerFlourish({ size = 36, color = 'var(--nijin)', rotate = 0, className }: { size?: number; color?: string; rotate?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
      <path d="M2 2 L 18 2 M2 2 L 2 18" stroke={color} strokeWidth={2} fill="none" />
      <path d="M6 6 C 14 6, 18 10, 18 16 C 18 20, 14 22, 11 19 C 9 17, 11 14, 13 15" stroke={color} strokeWidth={1.4} fill="none" />
      <path d="M6 6 C 6 14, 10 18, 16 18 C 20 18, 22 14, 19 11 C 17 9, 14 11, 15 13" stroke={color} strokeWidth={1.4} fill="none" />
      <circle cx={6} cy={6} r={2.2} fill={color} />
    </svg>
  );
}

/** Cloud scroll (祥云) for title cards. */
export function Xiangyun({ width = 120, color = 'var(--nijin)', className }: { width?: number; color?: string; className?: string }) {
  return (
    <svg className={className} width={width} height={width * 0.4} viewBox="0 0 120 48" aria-hidden="true">
      <path
        d="M4 38 C 4 28, 16 26, 20 32 C 20 20, 38 18, 42 28 C 46 14, 70 14, 72 28 C 78 20, 96 22, 94 34 C 104 30, 116 36, 112 44 L 8 44 C 4 44, 2 41, 4 38 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
      />
      <path d="M26 36 c 0 -5, 8 -5, 8 0 M54 32 c 0 -6, 10 -6, 10 0 M80 36 c 0 -4, 7 -4, 7 0" fill="none" stroke={color} strokeWidth={1.3} />
    </svg>
  );
}
