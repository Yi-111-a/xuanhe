import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAsset } from '../api/assets';
import { api, IS_MOCK } from '../api/client';
import type { SessionSummary } from '../api/types';
import { Xiangyun } from '../components/Ornaments';
import { useToast } from '../components/Toast';
import { lastSessionId, useGame } from '../store/game';

function TitleArt() {
  const roofs = Array.from({ length: 34 }, (_, i) => {
    const x = (i * 97) % 1920;
    const row = i % 3;
    return { x, y: 735 + row * 46, w: 70 + ((i * 37) % 60), h: 18 + row * 4 };
  });
  return (
    <svg className="title-art" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2238" />
          <stop offset="38%" stopColor="#5a3a43" />
          <stop offset="62%" stopColor="#c0663a" />
          <stop offset="76%" stopColor="#e8a95a" />
          <stop offset="100%" stopColor="#7a4a2c" />
        </linearGradient>
        <radialGradient id="t-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff2c4" />
          <stop offset="40%" stopColor="#f6c56a" />
          <stop offset="100%" stopColor="#f6c56a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="t-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2c07a" stopOpacity="0" />
          <stop offset="100%" stopColor="#f2c07a" stopOpacity="0.45" />
        </linearGradient>
        <filter id="t-smoke">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="40" />
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id="t-pillar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5e150e" />
          <stop offset="45%" stopColor="#a8301f" />
          <stop offset="100%" stopColor="#4a0f0a" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#t-sky)" />
      <circle cx="1240" cy="640" r="170" fill="url(#t-sun)" />
      <circle cx="1240" cy="640" r="34" fill="#ffe7a8" />
      {/* gold-leaf clouds */}
      {[
        [760, 180, 1.8],
        [1180, 120, 2.4],
        [1560, 230, 1.6],
        [980, 330, 1.3],
        [1420, 420, 1.1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity={0.55}>
          <path d="M4 38 C 4 28, 16 26, 20 32 C 20 20, 38 18, 42 28 C 46 14, 70 14, 72 28 C 78 20, 96 22, 94 34 C 104 30, 116 36, 112 44 L 8 44 C 4 44, 2 41, 4 38 Z" fill="#e8c06a" stroke="#a87a2c" strokeWidth="1.2" />
        </g>
      ))}
      {/* far mountains */}
      <path d="M520 640 C 640 560, 720 600, 800 560 C 900 510, 980 590, 1080 560 C 1200 520, 1300 600, 1420 560 C 1560 510, 1700 590, 1920 540 V 720 H 520 Z" fill="#4c5a74" opacity="0.65" />
      <path d="M520 680 C 660 630, 760 660, 900 640 C 1040 620, 1160 670, 1300 650 C 1460 630, 1640 680, 1920 640 V 760 H 520 Z" fill="#6b5a62" opacity="0.6" />
      {/* smoke on the north-east horizon */}
      <path d="M1720 640 C 1700 560, 1760 520, 1730 440 C 1710 380, 1770 330, 1750 250" stroke="#2a2626" strokeWidth="36" fill="none" opacity="0.55" filter="url(#t-smoke)" />
      {/* city wards */}
      <rect x="520" y="700" width="1400" height="380" fill="#3a2420" />
      {roofs.map((r, i) => (
        <path key={i} d={`M${r.x + 520} ${r.y} q ${r.w / 2} -${r.h} ${r.w} 0 l -6 6 h -${r.w - 12} z`} fill={i % 2 ? '#24140f' : '#2f1a14'} opacity={0.9} />
      ))}
      {Array.from({ length: 60 }, (_, i) => (
        <circle key={`lamp${i}`} cx={540 + ((i * 131) % 1380)} cy={760 + ((i * 53) % 260)} r={2.2} fill="#ffcf7a" opacity={0.75} />
      ))}
      {/* the central avenue and hall */}
      <path d="M1180 1080 L 1225 720 L 1255 720 L 1300 1080 Z" fill="#8a5a3a" opacity="0.35" />
      <g transform="translate(1240 690)">
        <path d="M-150 0 q 150 -46 300 0 l -16 10 h -268 z" fill="#1d0f0b" />
        <rect x="-120" y="10" width="240" height="40" fill="#5a1d14" />
        <path d="M-170 50 h 340 v 10 h -340 z" fill="#2a1712" />
      </g>
      <rect x="520" y="700" width="1400" height="380" fill="url(#t-mist)" />
      {/* foreground pillar and balustrade */}
      <rect x="440" y="0" width="92" height="1080" fill="url(#t-pillar)" />
      <rect x="430" y="0" width="112" height="40" fill="#3a1a10" />
      <g>
        <rect x="440" y="905" width="1480" height="22" fill="#7a2418" />
        <rect x="440" y="990" width="1480" height="30" fill="#5e1a10" />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i}>
            <rect x={520 + i * 125} y={890} width={18} height={140} fill="#6a1e14" />
            <circle cx={529 + i * 125} cy={884} r={12} fill="#c9a24b" />
          </g>
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={`p${i}`} x={548 + i * 125} y={930} width={88} height={52} fill="none" stroke="#c9a24b" strokeOpacity="0.55" strokeWidth="2" />
        ))}
      </g>
      {/* peonies */}
      {[
        [520, 960, 46, '#c94a5a'],
        [610, 1010, 38, '#e88fa0'],
        [450, 1030, 34, '#f3d6c8'],
        [700, 980, 30, '#c94a5a'],
      ].map(([x, y, r, c], i) => (
        <g key={`f${i}`} transform={`translate(${x} ${y})`}>
          {Array.from({ length: 9 }, (_, k) => (
            <ellipse key={k} rx={Number(r) * 0.55} ry={Number(r) * 0.3} transform={`rotate(${k * 40}) translate(${Number(r) * 0.42} 0)`} fill={String(c)} opacity={0.85} />
          ))}
          <circle r={Number(r) * 0.22} fill="#e8c06a" />
        </g>
      ))}
    </svg>
  );
}

export function TitleScreen() {
  const g = useGame();
  const toast = useToast();
  const [bg] = useAsset(['title.scroll', 'title.background', 'title.main', 'title.default']);
  const [saves, setSaves] = useState<SessionSummary[] | null>(null);
  const [health, setHealth] = useState<'checking' | 'ok' | 'down'>('checking');
  const [version, setVersion] = useState('');
  const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => {
        if (!alive) return;
        setHealth(h.ok ? 'ok' : 'down');
        setVersion(h.version);
      })
      .catch(() => alive && setHealth('down'));
    api
      .sessions()
      .then((s) => alive && setSaves(s))
      .catch(() => alive && setSaves([]));
    return () => {
      alive = false;
    };
  }, []);

  const continueGame = () => {
    const last = lastSessionId();
    const target = saves?.find((x) => x.id === last) ?? saves?.[0];
    if (target) void g.loadSession(target.id);
    else toast.info('尚无存档，请开始新局。');
  };

  const quit = async () => {
    try {
      await window.__TAURI_INTERNALS__?.invoke?.('plugin:window|close', { label: 'main' });
    } catch {
      toast.info('请直接关闭窗口。');
    }
  };

  const items = [
    { id: 'newGame', label: '开始新局', onClick: () => g.setScreen('newgame'), disabled: false },
    { id: 'continue', label: '继续', onClick: continueGame, disabled: !saves?.length || g.busy.load },
    { id: 'load', label: '史册存档', onClick: () => g.openPanel('timeline'), disabled: false },
    { id: 'settings', label: '设置', onClick: () => g.openPanel('settings'), disabled: false },
    ...(isTauri ? [{ id: 'quit', label: '退出', onClick: quit, disabled: false }] : []),
  ];

  return (
    <div className="title-screen" data-screen="title" data-testid="title.root">
      {bg ? <img className="title-art title-art--img" src={bg} alt="" draggable={false} /> : <TitleArt />}
      <div className="title-shade" aria-hidden="true" />
      <motion.div className="title-left" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, ease: [0.22, 0.8, 0.24, 1] }}>
        <div className="title-splash" aria-hidden="true" />
        <h1 className="title-logo t-title">
          <span>天</span>
          <span>宝</span>
        </h1>
        <div className="title-seal t-title" aria-hidden="true">
          盛
          <br />
          唐
        </div>
        <p className="title-sub t-title">天宝十载 · 公元七五一年</p>
        <Xiangyun width={150} className="title-cloud" />
        <nav className="title-menu">
          {items.map((it, i) => (
            <motion.button
              key={it.id}
              className="btn btn-ink title-btn"
              data-testid={`title.${it.id}`}
              onClick={it.onClick}
              disabled={it.disabled}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.09, duration: 0.5 }}
            >
              {it.label}
            </motion.button>
          ))}
        </nav>
      </motion.div>
      <motion.p className="title-hook t-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}>
        盛世只剩最后四年。你能阻止安史之乱吗？
      </motion.p>
      <div className="title-status" data-testid="title.health">
        <i className={`status-dot status-dot--${health}`} />
        {health === 'checking' ? '正在联络推演引擎…' : health === 'ok' ? `推演引擎已就绪${IS_MOCK ? '（演示数据）' : ''}${version ? ` · ${version}` : ''}` : '推演引擎未响应，请确认引擎已启动'}
      </div>
    </div>
  );
}
