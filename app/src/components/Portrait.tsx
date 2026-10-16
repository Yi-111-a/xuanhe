// Character portrait: the art agent's `portrait.<id>.default` when present, otherwise an
// ink-wash figure in Tang dress (round-collar robe by rank colour, soft-legged futou).
import { useId } from 'react';
import { useAsset } from '../api/assets';
import { cls, mulberry32, strSeed } from '../lib/util';

type Dress = { robe: string; kind: 'official' | 'emperor' | 'lady' | 'armor' | 'eunuch'; beard: 0 | 1 | 2; age: number };

const DRESS: Record<string, Dress> = {
  xuanzong: { robe: '#b8862e', kind: 'emperor', beard: 2, age: 0.9 },
  li_linfu: { robe: '#5b3a6b', kind: 'official', beard: 2, age: 0.8 },
  yang_guozhong: { robe: '#a3392c', kind: 'official', beard: 1, age: 0.5 },
  yang_guifei: { robe: '#b5463a', kind: 'lady', beard: 0, age: 0.2 },
  gao_lishi: { robe: '#5b3a6b', kind: 'eunuch', beard: 0, age: 0.85 },
  li_heng: { robe: '#4e4372', kind: 'official', beard: 1, age: 0.45 },
  chen_xilie: { robe: '#5b3a6b', kind: 'official', beard: 2, age: 0.75 },
  an_lushan: { robe: '#5b3a6b', kind: 'official', beard: 1, age: 0.5 },
  shi_siming: { robe: '#3c3a36', kind: 'armor', beard: 1, age: 0.5 },
  ji_wen: { robe: '#a3392c', kind: 'official', beard: 1, age: 0.5 },
  geshu_han: { robe: '#5b3a6b', kind: 'armor', beard: 2, age: 0.6 },
  gao_xianzhi: { robe: '#5b3a6b', kind: 'armor', beard: 1, age: 0.45 },
  feng_changqing: { robe: '#a3392c', kind: 'official', beard: 1, age: 0.5 },
  an_sishun: { robe: '#5b3a6b', kind: 'armor', beard: 2, age: 0.6 },
  guo_ziyi: { robe: '#a3392c', kind: 'armor', beard: 2, age: 0.55 },
  li_guangbi: { robe: '#a3392c', kind: 'armor', beard: 1, age: 0.4 },
  yan_zhenqing: { robe: '#3e7f6b', kind: 'official', beard: 2, age: 0.45 },
  yan_gaoqing: { robe: '#3e7f6b', kind: 'official', beard: 2, age: 0.6 },
  xianyu_zhongtong: { robe: '#5b3a6b', kind: 'official', beard: 1, age: 0.55 },
  bian_lingcheng: { robe: '#3e7f6b', kind: 'eunuch', beard: 0, age: 0.5 },
};

function dressFor(id: string): Dress {
  return DRESS[id] ?? { robe: '#a3392c', kind: 'official', beard: 1, age: 0.5 };
}

export function PortraitArt({ id, className }: { id: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const d = dressFor(id);
  const r = mulberry32(strSeed(id));
  const tilt = (r() - 0.5) * 4;
  const faceW = 30 + r() * 5 + (id === 'an_lushan' ? 8 : 0);
  const body = id === 'an_lushan' ? 1.18 : 1;
  const hair = d.age > 0.7 ? '#9a948a' : '#1e1b18';
  return (
    <svg className={className} viewBox="0 0 300 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#efe2c2" />
          <stop offset="70%" stopColor="#d8c08e" />
          <stop offset="100%" stopColor="#a98a55" />
        </radialGradient>
        <linearGradient id={`robe${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={d.robe} stopOpacity="0.95" />
          <stop offset="100%" stopColor={d.robe} stopOpacity="0.55" />
        </linearGradient>
        <filter id={`wash${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={Math.floor(r() * 50)} />
          <feDisplacementMap in="SourceGraphic" scale="5" />
        </filter>
        <linearGradient id={`fade${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.75" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`m${uid}`}>
          <rect width="300" height="400" fill={`url(#fade${uid})`} />
        </mask>
      </defs>
      <rect width="300" height="400" fill={`url(#bg${uid})`} />
      {/* distant hills wash */}
      <path d="M0 250 C 40 210, 70 230, 100 205 C 130 180, 160 220, 200 200 C 240 180, 270 215, 300 195 V 400 H 0 Z" fill="#6f8f80" opacity="0.18" />
      <path d="M0 290 C 50 260, 90 280, 140 262 C 190 245, 240 275, 300 255 V 400 H 0 Z" fill="#2f5d8a" opacity="0.12" />
      <g transform={`rotate(${tilt} 150 300)`} filter={`url(#wash${uid})`} mask={`url(#m${uid})`}>
        {/* shoulders and robe */}
        <path
          d={`M${150 - 115 * body} 400 C ${150 - 112 * body} 300, ${150 - 80 * body} 262, 150 255 C ${150 + 80 * body} 262, ${150 + 112 * body} 300, ${150 + 115 * body} 400 Z`}
          fill={`url(#robe${uid})`}
          stroke="#1e1b18"
          strokeWidth="2.4"
        />
        {d.kind === 'armor' && (
          <g stroke="#1e1b18" strokeWidth="1.6" fill="none" opacity="0.8">
            <path d="M70 300 C 110 285, 190 285, 230 300" />
            <path d="M66 320 C 110 305, 190 305, 234 320" />
            <circle cx="118" cy="330" r="16" fill="#c9a24b" fillOpacity="0.5" />
            <circle cx="182" cy="330" r="16" fill="#c9a24b" fillOpacity="0.5" />
          </g>
        )}
        {d.kind === 'lady' ? (
          <path d="M40 330 C 90 300, 120 320, 150 310 C 180 320, 210 300, 260 330" fill="none" stroke="#3e7f6b" strokeWidth="9" opacity="0.6" />
        ) : (
          <path d="M122 262 C 128 284, 172 284, 178 262" fill="none" stroke="#f3e9d2" strokeWidth="5" />
        )}
        {d.kind === 'emperor' && (
          <g fill="none" stroke="#7a4f17" strokeWidth="1.5" opacity="0.7">
            <circle cx="105" cy="335" r="20" />
            <circle cx="195" cy="335" r="20" />
          </g>
        )}
        {/* neck & face */}
        <path d="M138 232 L 138 258 L 162 258 L 162 232 Z" fill="#e3c9a0" stroke="#1e1b18" strokeWidth="1.5" />
        <ellipse cx="150" cy="200" rx={faceW} ry={faceW * 1.25} fill="#ecd6b0" stroke="#1e1b18" strokeWidth="2.2" />
        {/* features */}
        <g stroke="#1e1b18" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d={`M${150 - faceW * 0.55} 192 q 8 -4 15 0`} />
          <path d={`M${150 + faceW * 0.55 - 15} 192 q 8 -4 15 0`} />
          <path d={`M${150 - faceW * 0.5} 184 q 10 -6 18 -2`} strokeWidth="2.6" />
          <path d={`M${150 + faceW * 0.5 - 18} 182 q 8 -4 18 2`} strokeWidth="2.6" />
          <path d="M150 197 q -3 12 2 14" strokeWidth="1.4" />
          <path d="M142 224 q 8 3 16 0" strokeWidth="1.6" />
        </g>
        {d.beard > 0 && (
          <g fill={hair} opacity="0.85">
            <path d="M136 220 q 14 -5 28 0 q -2 5 -14 5 q -12 0 -14 -5 Z" />
            {d.beard > 1 && <path d={`M140 228 q 10 ${30 + d.age * 20} 10 ${36 + d.age * 24} q 2 -6 10 -${36 + d.age * 24} Z`} />}
          </g>
        )}
        {/* headwear */}
        {d.kind === 'lady' ? (
          <g fill="#1e1b18">
            <path d="M112 186 C 108 140, 192 140, 188 186 C 182 166, 118 166, 112 186 Z" />
            <ellipse cx="150" cy="128" rx="34" ry="24" />
            <ellipse cx="128" cy="112" rx="14" ry="18" transform="rotate(-25 128 112)" />
            <circle cx="176" cy="132" r="6" fill="#c0392b" />
            <circle cx="150" cy="170" r="3" fill="#c0392b" />
          </g>
        ) : d.kind === 'armor' ? (
          <g>
            <path d="M108 190 C 104 128, 196 128, 192 190 L 186 176 C 180 150, 120 150, 114 176 Z" fill="#4a463f" stroke="#1e1b18" strokeWidth="2" />
            <path d="M150 132 l 0 -18" stroke="#c0392b" strokeWidth="6" strokeLinecap="round" />
          </g>
        ) : (
          <g fill="#151311" stroke="#000" strokeWidth="1">
            <path d="M112 182 C 110 136, 190 136, 188 182 C 178 168, 122 168, 112 182 Z" />
            <path d="M128 150 C 128 122, 172 122, 172 150 Z" />
            {/* soft legs of the futou */}
            <path d="M184 168 C 204 176, 214 206, 206 240 C 202 214, 192 192, 180 180 Z" opacity="0.9" />
            <path d="M116 168 C 96 176, 86 206, 94 240 C 98 214, 108 192, 120 180 Z" opacity="0.9" />
          </g>
        )}
        {d.kind === 'emperor' && <rect x="138" y="118" width="24" height="10" fill="#c9a24b" stroke="#1e1b18" />}
        {d.kind !== 'lady' && d.kind !== 'armor' && (
          <rect x="200" y="285" width="12" height="80" rx="3" transform="rotate(14 206 325)" fill="#efe6d0" stroke="#1e1b18" strokeWidth="1.5" />
        )}
      </g>
    </svg>
  );
}

export function Portrait({ id, className, variant = 'default' }: { id: string; className?: string; variant?: string }) {
  const [url, settled] = useAsset([`portrait.${id}.${variant}`, `portrait.${id}.default`, `portrait.${id}`, `character.${id}.portrait`]);
  return (
    <div className={cls('portrait', className)} data-art={url ? 'image' : 'fallback'}>
      {url ? <img src={url} alt="" draggable={false} /> : settled ? <PortraitArt id={id} /> : <div className="portrait-pending" />}
    </div>
  );
}
