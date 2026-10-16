// Event illustration with a painted ink-wash fallback (green-blue landscape, seeded).
import { useId, useState } from 'react';
import { useAsset } from '../api/assets';
import { cls, mulberry32, strSeed } from '../lib/util';

type Mood = 'calm' | 'war' | 'court' | 'frontier' | 'flood';

function moodOf(seed: string): Mood {
  if (/defeat|uprising|talas|battle|khitan|xier|war|败|兵/.test(seed)) return 'war';
  if (/court|palace|huaqing|xier|li_linfu|chancellor|宫|相/.test(seed)) return 'court';
  if (/anxi|hexi|frontier|caravan|nanzhao/.test(seed)) return 'frontier';
  if (/canal|grain|rain|flood|漕|粮/.test(seed)) return 'flood';
  return 'calm';
}

export function InkScene({ seed, className }: { seed: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const r = mulberry32(strSeed(seed));
  const mood = moodOf(seed);
  const sky = mood === 'war' ? ['#c9a58a', '#8d5a46'] : mood === 'court' ? ['#efdcb4', '#d8b77c'] : ['#eadfc4', '#cdbb93'];
  const ridges = Array.from({ length: 3 }, (_, i) => {
    const base = 150 + i * 42;
    let d = `M0 ${base}`;
    for (let x = 0; x <= 400; x += 40) d += ` Q ${x + 20} ${base - 30 - r() * 70 + i * 10} ${x + 40} ${base - r() * 25}`;
    return `${d} V 300 H 0 Z`;
  });
  return (
    <svg className={cls('ink-scene', className)} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="100%" stopColor={sky[1]} />
        </linearGradient>
        <filter id={`w${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={Math.floor(r() * 99)} />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </defs>
      <rect width="400" height="300" fill={`url(#s${uid})`} />
      <circle cx={80 + r() * 240} cy={60 + r() * 30} r={mood === 'war' ? 26 : 18} fill={mood === 'war' ? '#c0392b' : '#e9c46a'} opacity={0.7} />
      <g filter={`url(#w${uid})`}>
        <path d={ridges[0]} fill="#2f5d8a" opacity="0.45" />
        <path d={ridges[1]} fill="#3e7f6b" opacity="0.6" />
        <path d={ridges[2]} fill="#1e3b33" opacity="0.75" />
      </g>
      {mood === 'flood' && <path d="M0 250 Q 100 235 200 250 T 400 250 V 300 H 0 Z" fill="#5d89b0" opacity="0.5" />}
      {mood === 'court' && (
        <g transform="translate(200 205)" fill="#5a1d14">
          <path d="M-90 0 q 90 -30 180 0 l -10 8 h -160 z" fill="#1e1b18" />
          <rect x="-70" y="8" width="140" height="34" />
          {[-50, -20, 10, 40].map((x) => (
            <rect key={x} x={x} y="12" width="8" height="30" fill="#c9a24b" opacity="0.6" />
          ))}
        </g>
      )}
      {mood === 'war' &&
        Array.from({ length: 7 }, (_, i) => (
          <g key={i} transform={`translate(${60 + i * 45 + r() * 10} ${215 + r() * 20})`}>
            <line x1="0" y1="0" x2="0" y2="-60" stroke="#1e1b18" strokeWidth="2" />
            <path d="M0 -60 l 26 6 l -26 8 z" fill="#b2321f" />
          </g>
        ))}
      {mood === 'frontier' &&
        Array.from({ length: 5 }, (_, i) => (
          <g key={i} transform={`translate(${70 + i * 55} ${238 + (i % 2) * 6})`} fill="#3d2a1c">
            <ellipse cx="0" cy="0" rx="16" ry="7" />
            <path d="M-6 -6 q 3 -10 8 -2 q 4 -10 8 0" />
            <rect x="-12" y="4" width="2" height="12" />
            <rect x="9" y="4" width="2" height="12" />
          </g>
        ))}
    </svg>
  );
}

/**
 * Event illustration. While the art resolves or decodes, the seeded ink-wash scene shows
 * underneath, so the frame is never an empty box; `url` skips resolution when the caller
 * already knows the image.
 */
export function EventArt({ ids, seed, className, round = false, url: known }: { ids: (string | undefined | null)[]; seed: string; className?: string; round?: boolean; url?: string | null }) {
  const list = ids.filter(Boolean) as string[];
  const expanded = known ? [] : list.flatMap((id) => [id, `${id}.illustration`]);
  const [resolved, settled] = useAsset(expanded);
  const url = known ?? resolved;
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = Boolean(url && loaded === url);
  return (
    <div className={cls('event-art', round && 'event-art--round', className)} data-art={url ? 'image' : settled ? 'fallback' : 'pending'}>
      {(!ready || !url) && (url || settled) ? <InkScene seed={seed} /> : null}
      {url && <img src={url} alt="" draggable={false} onLoad={() => setLoaded(url)} className={ready ? 'is-loaded' : 'is-loading'} />}
    </div>
  );
}
