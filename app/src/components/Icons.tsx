// Gold line-art icons (fallbacks for icon.<resource> art). Drawn in a 48×48 box.
import type { ReactElement } from 'react';
import { useAsset } from '../api/assets';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<string, ReactElement> = {
  treasury: (
    <g {...P}>
      <circle cx={24} cy={24} r={15} />
      <circle cx={24} cy={24} r={11.5} strokeWidth={1.2} />
      <rect x={19.5} y={19.5} width={9} height={9} />
    </g>
  ),
  grain: (
    <g {...P}>
      <path d="M24 42 C 24 30, 23 20, 30 8" />
      {[12, 17, 22, 27].map((y, i) => (
        <g key={y}>
          <ellipse cx={30 - i * 1.6 - 4} cy={y} rx={3.4} ry={1.8} transform={`rotate(-35 ${30 - i * 1.6 - 4} ${y})`} />
          <ellipse cx={30 - i * 1.6 + 3} cy={y + 2} rx={3.4} ry={1.8} transform={`rotate(35 ${30 - i * 1.6 + 3} ${y + 2})`} />
        </g>
      ))}
      <path d="M24 36 C 18 34, 14 30, 12 26" />
    </g>
  ),
  authority: (
    <g {...P}>
      <rect x={12} y={24} width={24} height={16} rx={1.5} />
      <path d="M17 24 C 17 16, 20 12, 24 12 C 28 12, 31 16, 31 24" />
      <circle cx={24} cy={9.5} r={2.5} />
      <path d="M18 30 h12 M18 34.5 h12" strokeWidth={1.4} />
    </g>
  ),
  morale: (
    <g {...P}>
      <circle cx={24} cy={15} r={4.6} />
      <circle cx={12.5} cy={19} r={3.8} />
      <circle cx={35.5} cy={19} r={3.8} />
      <path d="M15 40 C 15 28, 33 28, 33 40" />
      <path d="M5 39 C 5 30, 13 27, 18 30" />
      <path d="M43 39 C 43 30, 35 27, 30 30" />
    </g>
  ),
  corruption: (
    <g {...P}>
      <path d="M24 8 V 40 M14 40 h20" />
      <path d="M10 14 h28" />
      <path d="M10 14 L 5 26 h10 Z" />
      <path d="M38 14 L 33 30 h10 Z" />
      <circle cx={24} cy={8} r={2} />
    </g>
  ),
  frontier_pressure: (
    <g {...P}>
      <path d="M15 42 L 18 20 H 30 L 33 42 Z" />
      <path d="M16 20 h16 v-4 h-16 Z" />
      <path d="M24 14 C 20 10, 23 7, 22 3 C 27 6, 30 10, 26 14" />
      <path d="M20 30 h8" strokeWidth={1.4} />
    </g>
  ),
  fanzhen_power: (
    <g {...P}>
      <path d="M14 44 V 4" />
      <path d="M14 7 C 22 4, 28 11, 38 8 V 24 C 28 27, 22 20, 14 23" />
      <path d="M38 24 l -4 6 M30 25.5 l -2 6 M22 23.5 l -1 6" strokeWidth={1.5} />
    </g>
  ),
  court_strife: (
    <g {...P}>
      <path d="M14 42 L 30 6 L 34 8 L 18 44 Z" />
      <path d="M34 42 L 18 6 L 14 8 L 30 44 Z" />
    </g>
  ),
  an_ambition: (
    <g {...P}>
      <path d="M4 24 C 12 12, 36 12, 44 24 C 36 36, 12 36, 4 24 Z" />
      <circle cx={24} cy={24} r={6.5} />
      <circle cx={24} cy={24} r={2} fill="currentColor" />
    </g>
  ),
  rebellion_risk: (
    <g {...P}>
      <ellipse cx={24} cy={16} rx={15} ry={6} />
      <path d="M9 16 V 32 C 9 36, 39 36, 39 32 V 16" />
      <path d="M14 20 v 12 M24 22 v 13 M34 20 v 12" strokeWidth={1.3} />
      <path d="M33 4 L 42 13" />
    </g>
  ),
};

export function ResourceIcon({ id, size = 26 }: { id: string; size?: number }) {
  const [url] = useAsset([`icon.${id}`, `icon.resource.${id}`]);
  if (url) return <img src={url} width={size} height={size} alt="" draggable={false} style={{ objectFit: 'contain' }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {ICONS[id] ?? <circle cx={24} cy={24} r={14} {...P} />}
    </svg>
  );
}
