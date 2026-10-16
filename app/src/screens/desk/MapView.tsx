// 舆图: full-bleed painted map with an SVG region overlay (hover, select, five layers),
// army tokens, the canal lifeline and the historical rebel route.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { useAsset, useMapData, type MapData } from '../../api/assets';
import { nameOf } from '../../lib/names';
import type { Army, PublicState, ViewResponse } from '../../api/types';
import type { MapLayer } from '../../store/game';
import { cls, fmtWan, mulberry32 } from '../../lib/util';
import {
  CANAL,
  GEO_H,
  GEO_W,
  LAND_PATH,
  MOUNTAINS,
  REBEL_PATH,
  RIVERS,
  SEAT_NAMES,
  SEATS,
  schematicCells,
  smoothPath,
  toPath,
  type Pt,
} from './geo';
import { grow, hits, HUD_ATTR, height, inside, shift, largestFreeRect, measureHud, nudge, placeCard, rect, width, type Rect } from './safeArea';
import { travelPath } from '../../lib/route';

/** gap kept between the map content and any HUD piece, and from the screen edge (px) */
const HUD_PAD = 8;
const EDGE = 10;
/** below this map scale, glyphs (names, seats, army tags) stop shrinking with the painting */
const GLYPH_REF = 0.64;

const FOREIGN = new Set(['tubo', 'nanzhao', 'khitan_xi', 'huihe']);
const CANAL_REGIONS = ['jiangnan', 'huainan', 'henan', 'duji', 'tongguan', 'jingji'];
const AN_OFFICES = ['fanyang', 'pinglu', 'hedong'];

interface Shape {
  id: string;
  d: string;
  seat: Pt;
  label: Pt;
  foreign?: boolean;
  /** bounding box in map coordinates (polygons, or a disc around the seat) */
  bbox: Rect;
}

interface Geometry {
  width: number;
  height: number;
  shapes: Shape[];
  mode: 'art' | 'image-only' | 'schematic';
  scale: number;
}

function centroid(poly: number[][]): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

function bboxOf(polys: number[][][], seat: Pt, r: number): Rect {
  let b = rect(seat[0] - r, seat[1] - r, seat[0] + r, seat[1] + r);
  let first = true;
  for (const p of polys) {
    for (const [x, y] of p) {
      b = first ? rect(x, y, x, y) : rect(Math.min(b.l, x), Math.min(b.t, y), Math.max(b.r, x), Math.max(b.b, y));
      first = false;
    }
  }
  return b;
}

function geometryFrom(map: MapData | null, hasImage: boolean, imgSize: [number, number] | null): Geometry {
  if (map) {
    const shapes: Shape[] = map.regions.map((r) => {
      const polys = r.polygons ?? (r.polygon ? [r.polygon] : []);
      const d = polys.map((p) => toPath(p as Pt[])).join(' ');
      const fallback: Pt = polys[0] ? centroid(polys[0]) : [0, 0];
      const seatRaw = r.capital ?? (Array.isArray(r.seat) ? r.seat : r.seat ? [r.seat.x, r.seat.y] : null) ?? r.center ?? r.label;
      const seat = (seatRaw as Pt | null) ?? fallback;
      const label = ((r.label ?? r.center) as Pt | undefined) ?? seat;
      return { id: r.id, d, seat, label, foreign: r.foreign, bbox: bboxOf(polys, seat, 46 * (map.width / GEO_W)) };
    });
    return { width: map.width, height: map.height, shapes, mode: hasImage ? 'art' : 'schematic', scale: map.width / GEO_W };
  }
  if (hasImage && imgSize) {
    const sx = imgSize[0] / GEO_W;
    const sy = imgSize[1] / GEO_H;
    return {
      width: imgSize[0],
      height: imgSize[1],
      mode: 'image-only',
      scale: sx,
      shapes: Object.entries(SEATS).map(([id, p]) => {
        const seat: Pt = [p[0] * sx, p[1] * sy];
        return { id, d: '', seat, label: seat, bbox: bboxOf([], seat, 46 * sx) };
      }),
    };
  }
  const cells = schematicCells();
  return {
    width: GEO_W,
    height: GEO_H,
    mode: 'schematic',
    scale: 1,
    shapes: Object.entries(SEATS).map(([id, seat]) => ({ id, d: cells[id], seat, label: seat, bbox: bboxOf([], seat, 46) })),
  };
}

// ---------------------------------------------------------------- static painted base (fallback art)
const SchematicBase = memo(function SchematicBase() {
  const peaks = useMemo(() => {
    const out: { x: number; y: number; s: number; v: number }[] = [];
    MOUNTAINS.forEach((m, mi) => {
      const r = mulberry32(100 + mi);
      for (let i = 0; i < m.n; i++) {
        out.push({
          x: m.at[0] + (r() - 0.5) * 2 * m.spread[0],
          y: m.at[1] + (r() - 0.5) * 2 * m.spread[1],
          s: m.scale * (0.75 + r() * 0.6),
          v: r(),
        });
      }
    });
    return out.sort((a, b) => a.y - b.y);
  }, []);
  const dunes = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 140 }, () => [180 + r() * 380, 270 + r() * 110] as Pt);
  }, []);
  return (
    <svg className="map-base" viewBox={`0 0 ${GEO_W} ${GEO_H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="mb-sea" cx="30%" cy="45%" r="90%">
          <stop offset="0%" stopColor="#5f8fa6" />
          <stop offset="60%" stopColor="#2f5d8a" />
          <stop offset="100%" stopColor="#1d3c5c" />
        </radialGradient>
        <radialGradient id="mb-land" cx="55%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#e9d6a6" />
          <stop offset="70%" stopColor="#d9bf88" />
          <stop offset="100%" stopColor="#c4a46c" />
        </radialGradient>
        <linearGradient id="mb-peak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f5d8a" />
          <stop offset="55%" stopColor="#3e7f6b" />
          <stop offset="100%" stopColor="#7ea889" stopOpacity="0.4" />
        </linearGradient>
        <pattern id="mb-waves" width="46" height="18" patternUnits="userSpaceOnUse">
          <path d="M0 12 q 11.5 -9 23 0 t 23 0" fill="none" stroke="#bcd3d4" strokeOpacity="0.28" strokeWidth="1.2" />
        </pattern>
        <filter id="mb-silk" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves="2" seed="4" result="f" />
          <feColorMatrix in="f" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.16  0 0 0 0.16 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="mb-blot" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9" />
          <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0 0.12  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id="mb-landclip">
          <path d={LAND_PATH} />
        </clipPath>
      </defs>
      <rect width={GEO_W} height={GEO_H} fill="url(#mb-sea)" />
      <rect width={GEO_W} height={GEO_H} fill="url(#mb-waves)" />
      {/* coastal bands */}
      <path d={LAND_PATH} fill="none" stroke="#9cc3bf" strokeOpacity="0.35" strokeWidth="26" />
      <path d={LAND_PATH} fill="none" stroke="#d6e4d8" strokeOpacity="0.35" strokeWidth="12" />
      <path d={LAND_PATH} fill="url(#mb-land)" />
      <g clipPath="url(#mb-landclip)">
        <rect width={GEO_W} height={GEO_H} fill="#000" filter="url(#mb-blot)" />
        {/* west: Tarim sands */}
        {dunes.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={1.3} fill="#9a7442" opacity={0.45} />
        ))}
        {/* plateau wash */}
        <ellipse cx={380} cy={760} rx={330} ry={170} fill="#7c9a8a" opacity={0.18} />
        <ellipse cx={1140} cy={150} rx={300} ry={90} fill="#8aa07b" opacity={0.12} />
        {RIVERS.map((r) => (
          <g key={r.id}>
            <path d={smoothPath(r.pts)} fill="none" stroke="#3a6f8f" strokeOpacity="0.65" strokeWidth={r.width + 2.5} strokeLinecap="round" />
            <path d={smoothPath(r.pts)} fill="none" stroke="#9cc6d0" strokeOpacity="0.9" strokeWidth={r.width * 0.55} strokeLinecap="round" />
          </g>
        ))}
        {peaks.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
            <path d="M-34 14 C -22 -6, -14 -26, -4 -30 C 4 -22, 12 -6, 22 2 C 26 -6, 30 -12, 34 -12 C 40 -4, 44 6, 48 14 Z" fill="url(#mb-peak)" opacity={0.78 + p.v * 0.2} />
            <path d="M-34 14 C -22 -6, -14 -26, -4 -30 C 4 -22, 12 -6, 22 2 C 26 -6, 30 -12, 34 -12 C 40 -4, 44 6, 48 14" fill="none" stroke="#1f2f2a" strokeOpacity="0.55" strokeWidth={1.4} />
            <path d="M-4 -30 C -8 -16, -12 -4, -18 8 M34 -12 C 32 -4, 30 4, 26 12" fill="none" stroke="#f3ead2" strokeOpacity="0.55" strokeWidth={1.2} />
          </g>
        ))}
        <rect width={GEO_W} height={GEO_H} fill="#fff" opacity="0.001" filter="url(#mb-silk)" />
      </g>
      <path d={LAND_PATH} fill="none" stroke="#2b3d39" strokeOpacity="0.55" strokeWidth="1.6" />
    </svg>
  );
});

// ---------------------------------------------------------------- dynamic overlay
function layerFill(layer: MapLayer, id: string, state: PublicState, crisis: number, armiesBy: Record<string, Army[]>): { fill: string; opacity: number } {
  const region = state.regions[id];
  const controller = region?.controller ?? (FOREIGN.has(id) ? id : 'tang');
  if (controller === 'yan') return { fill: 'var(--zhusha)', opacity: 0.5 };
  if (FOREIGN.has(id)) return { fill: '#5b5148', opacity: 0.18 };
  const anHolds = (rid: string) => {
    if (rid === 'hedong' && state.flags?.hedong_to_an) return true;
    const office = state.offices?.[`${rid}_jds`];
    return office?.holder === 'an_lushan';
  };
  switch (layer) {
    case 'jurisdiction': {
      if (AN_OFFICES.includes(id) && anHolds(id)) return { fill: 'var(--shilv)', opacity: 0.32 + Math.min(0.25, crisis / 300) };
      if (id === 'jingji' || id === 'duji' || id === 'tongguan') return { fill: 'var(--nijin)', opacity: 0.28 };
      if (state.offices?.[`${id}_jds`]) return { fill: 'var(--zheshi)', opacity: 0.2 };
      return { fill: '#f3e6c4', opacity: 0.1 };
    }
    case 'morale': {
      const order = region?.stats?.order ?? 60;
      const t = Math.max(0, Math.min(1, (order - 30) / 50));
      const fill = t < 0.5 ? 'var(--zhusha)' : t < 0.75 ? 'var(--nijin)' : 'var(--shilv)';
      return { fill, opacity: 0.18 + Math.abs(t - 0.6) * 0.45 };
    }
    case 'troops': {
      const total = (armiesBy[id] ?? []).reduce((a, x) => a + x.strength, 0);
      return { fill: 'var(--shiqing)', opacity: total ? Math.min(0.42, 0.05 + total / 260000) : 0.02 };
    }
    case 'canal': {
      if (!CANAL_REGIONS.includes(id)) return { fill: '#3d342b', opacity: 0.16 };
      return { fill: 'var(--nijin)', opacity: 0.34 };
    }
    case 'beacon': {
      const idx = REBEL_PATH.indexOf(id);
      if (idx < 0 && id !== 'pinglu') return { fill: '#3d342b', opacity: 0.12 };
      const heat = Math.max(0, crisis - 20) / 80;
      return { fill: 'var(--zhusha)', opacity: 0.12 + heat * (idx <= 1 || id === 'pinglu' ? 0.5 : 0.3) };
    }
  }
}

export function MapView({
  view,
  layer,
  selected,
  onSelect,
  army = null,
  etas = null,
  onPickTarget,
}: {
  view: ViewResponse;
  layer: MapLayer;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** 兵部 open: the selected army (its routes are drawn) and the chosen destination */
  army?: { army: string | null; target: string | null } | null;
  /** seasons of travel from that army to every region (GET /armies), null = unreachable */
  etas?: Record<string, number | null> | null;
  onPickTarget?: (regionId: string) => void;
}) {
  const [mapData, mapSettled] = useMapData();
  const [baseUrl, baseSettled] = useAsset(['map.base', 'ui.map.base', 'map.base.default']);
  const [imgSize, setImgSize] = useState<[number, number] | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const state = view.state;
  const crisisValue = Array.isArray(view.crisis.value_or_estimate)
    ? (view.crisis.value_or_estimate[0] + view.crisis.value_or_estimate[1]) / 2
    : view.crisis.value_or_estimate;
  const rebelled = Boolean(state.flags?.rebellion_started);

  const geo = useMemo(() => geometryFrom(mapData, Boolean(baseUrl), imgSize), [mapData, baseUrl, imgSize]);
  const k = geo.scale;
  // 「自A赴B，约n季后到」 for armies and characters on the road
  const transit = (t: Record<string, unknown> | null | undefined) => {
    if (!t || typeof t.to_region !== 'string') return '';
    const to = state.regions[t.to_region]?.name ?? nameOf(t.to_region) ?? '';
    const eta = typeof t.eta_turn === 'number' ? Math.max(1, t.eta_turn - state.turn) : null;
    return `赴${to}${eta ? `，约${eta}季后到` : ''}`;
  };
  const armiesBy = useMemo(() => {
    const out: Record<string, Army[]> = {};
    for (const a of Object.values(state.armies ?? {})) {
      if (a.strength <= 0) continue;
      (out[a.region] ??= []).push(a);
    }
    return out;
  }, [state.armies]);
  const seatOf = useMemo(() => Object.fromEntries(geo.shapes.map((s) => [s.id, s.seat])), [geo]);
  const ready = mapSettled && baseSettled && (!baseUrl || mapData || imgSize);

  // ---- HUD safe area, fit, pan & zoom
  // The lacquer HUD sits on every edge of the desk. The map is fitted, keeping its aspect, into the
  // largest rectangle the HUD leaves free, so the whole content extent (every region polygon and
  // label anchor) is in view on load; the desk shows around it. The wheel zooms in from there, and
  // dragging can bring any region to the centre of the screen.
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hud, setHud] = useState<{ obs: Rect[]; key: string } | null>(null);
  const [fontsIn, setFontsIn] = useState(false);
  const [easing, setEasing] = useState(false);
  const [tf, setTf] = useState<{ s: number; x: number; y: number; key: string } | null>(null);
  const geoKey = `${geo.width}x${geo.height}`;
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const userMoved = useRef(false);
  const lastBox = useRef({ w: 0, h: 0 });
  const shownRef = useRef(false);
  const easeTimer = useRef(0);

  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const host = el.getBoundingClientRect();
    const obs = measureHud(el.closest('.desk') ?? el.ownerDocument, host).map((o) => grow(o, HUD_PAD));
    const key = obs.map((o) => `${Math.round(o.l)},${Math.round(o.t)},${Math.round(o.r)},${Math.round(o.b)}`).join(';');
    const w = el.clientWidth;
    const h = el.clientHeight;
    setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    setHud((prev) => (prev && prev.key === key ? prev : { obs, key }));
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const scope = el.closest('.desk');
    let raf = 0;
    let alive = true;
    const watched = new Set<Element>();
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!alive) return;
        measure();
        (scope ?? document).querySelectorAll(`[${HUD_ATTR}]`).forEach((h) => {
          if (watched.has(h)) return;
          watched.add(h);
          ro.observe(h);
        });
      });
    };
    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);
    // HUD pieces that come and go (急务待决, the final notice) change the free area
    const mo = new MutationObserver((list) => {
      if (list.some((m) => !el.contains(m.target))) schedule();
    });
    if (scope) mo.observe(scope, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    measure();
    schedule();
    const timers = [window.setTimeout(schedule, 400), window.setTimeout(schedule, 1200)];
    // the HUD's width depends on the webfonts: reveal the map once they are in and measured
    const fonts = document.fonts?.ready ?? Promise.resolve();
    void fonts.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!alive) return;
          measure();
          setFontsIn(true);
        }),
      ),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach((x) => window.clearTimeout(x));
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  /** what must be visible: every polygon and label anchor (the whole image for fallback art) */
  const extent = useMemo(() => {
    const full = rect(0, 0, geo.width, geo.height);
    if (!mapData) return full;
    let e: Rect | null = null;
    for (const s of geo.shapes) {
      for (const r of [s.bbox, rect(s.label[0], s.label[1], s.label[0], s.label[1])]) {
        e = e ? rect(Math.min(e.l, r.l), Math.min(e.t, r.t), Math.max(e.r, r.r), Math.max(e.b, r.b)) : r;
      }
    }
    if (!e || width(e) < 50 || height(e) < 50) return full;
    return rect(Math.max(0, e.l), Math.max(0, e.t), Math.min(geo.width, e.r), Math.min(geo.height, e.b));
  }, [geo, mapData]);
  /** the points a player may want in the middle of the screen: seats and label anchors */
  const anchors = useMemo(() => {
    const xs = geo.shapes.flatMap((s) => [s.seat[0], s.label[0]]);
    const ys = geo.shapes.flatMap((s) => [s.seat[1], s.label[1]]);
    return xs.length ? rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)) : extent;
  }, [geo, extent]);

  const layout = useMemo(() => {
    if (!box.w || !box.h || !hud) return null;
    const bounds = rect(EDGE, EDGE, box.w - EDGE, box.h - EDGE);
    const free = largestFreeRect(bounds, hud.obs, width(extent) / height(extent));
    const s = width(free) / width(extent);
    return { bounds, free, fit: { s, x: free.l - extent.l * s, y: free.t - extent.t * s } };
  }, [box.w, box.h, hud, extent]);
  const cover = box.w && box.h ? Math.max(box.w / geo.width, box.h / geo.height) : 1;
  const maxScale = layout ? Math.max(cover * 2.4, layout.fit.s * 3.2) : cover * 2.4;

  const clampTf = useCallback(
    (t: { s: number; x: number; y: number }) => {
      if (!layout) return t;
      const { free, fit } = layout;
      const s = Math.max(fit.s, Math.min(maxScale, t.s));
      // either the content fills the free rect (padding = the HUD insets), or any seat / label
      // anchor may sit at the centre of the screen (or of the free rect)
      const axis = (pos: number, fLo: number, fHi: number, eLo: number, eHi: number, aLo: number, aHi: number, size: number) => {
        const a = fLo - eLo * s;
        const b = fHi - eHi * s;
        const c1 = Math.min((fLo + fHi) / 2, size / 2);
        const c2 = Math.max((fLo + fHi) / 2, size / 2);
        return Math.max(Math.min(a, b, c1 - aHi * s), Math.min(Math.max(a, b, c2 - aLo * s), pos));
      };
      return {
        s,
        x: axis(t.x, free.l, free.r, extent.l, extent.r, anchors.l, anchors.r, box.w),
        y: axis(t.y, free.t, free.b, extent.t, extent.b, anchors.t, anchors.b, box.h),
      };
    },
    [layout, maxScale, extent, anchors, box.w, box.h],
  );

  const shown = Boolean(fontsIn && ready && layout && tf);
  useEffect(() => {
    if (!layout || !ready) return;
    const resized = lastBox.current.w !== box.w || lastBox.current.h !== box.h;
    lastBox.current = { w: box.w, h: box.h };
    setTf((prev) => {
      const fresh = !prev || prev.key !== geoKey;
      if (fresh) userMoved.current = false;
      const next = fresh || resized || !userMoved.current ? layout.fit : clampTf(prev);
      return { ...next, key: geoKey };
    });
    // once the map is on screen, refits glide instead of jumping
    if (shownRef.current) {
      setEasing(true);
      window.clearTimeout(easeTimer.current);
      easeTimer.current = window.setTimeout(() => setEasing(false), 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, ready, geoKey]);
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => (shownRef.current = true), 50);
    return () => window.clearTimeout(id);
  }, [shown]);
  useEffect(() => () => window.clearTimeout(easeTimer.current), []);
  const t = tf ?? { s: cover, x: 0, y: 0 };

  const stopEasing = () => {
    if (!easing) return;
    window.clearTimeout(easeTimer.current);
    setEasing(false);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !(e.buttons & 1)) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setHover(null);
      stopEasing();
    }
    userMoved.current = true;
    setTf({ ...clampTf({ s: t.s, x: d.tx + dx, y: d.ty + dy }), key: geoKey });
  };
  const onPointerUp = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  };
  const onWheel = (e: WheelEvent) => {
    const host = rootRef.current?.getBoundingClientRect();
    if (!host) return;
    // Zoom by how far the wheel turned: one mouse notch (~100px) ≈ ×1.16, touchpads glide smoothly.
    const pixels = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const f = Math.min(1.8, Math.max(1 / 1.8, Math.exp(-pixels * 0.0015)));
    zoomAt(f, e.clientX - host.left, e.clientY - host.top);
  };
  const zoomAt = (f: number, px: number, py: number) => {
    if (!layout || f === 1) return;
    const s = Math.max(layout.fit.s, Math.min(maxScale, t.s * f));
    if (f < 1 && s <= layout.fit.s * 1.0001) {
      // zoomed all the way out: glide back to the fitted view (whole map in the safe area)
      if (t.s <= layout.fit.s * 1.0001 && Math.abs(t.x - layout.fit.x) < 1 && Math.abs(t.y - layout.fit.y) < 1) return;
      userMoved.current = false;
      setTf({ ...layout.fit, key: geoKey });
      setEasing(true);
      window.clearTimeout(easeTimer.current);
      easeTimer.current = window.setTimeout(() => setEasing(false), 700);
      return;
    }
    stopEasing();
    userMoved.current = true;
    setTf({ ...clampTf({ s, x: px - ((px - t.x) * s) / t.s, y: py - ((py - t.y) * s) / t.s }), key: geoKey });
  };

  // ---- glyph size: when the map is shown small, names, seats and army tags shrink less than the
  // painting so they stay legible
  const glyph = Math.max(1, Math.min(1.75, GLYPH_REF / t.s));
  const G = k * glyph;

  // ---- region labels: measured once (font metrics), then nudged out from under the HUD
  const [labelBoxes, setLabelBoxes] = useState<Record<string, [number, number, number, number]>>({});
  const regionCount = Object.keys(state.regions).length;
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !ready) return;
    const next: Record<string, [number, number, number, number]> = {};
    el.querySelectorAll<SVGTextElement>('text.region-name[data-label]').forEach((tx) => {
      try {
        const b = tx.getBBox();
        if (b.width > 0) next[tx.dataset.label!] = [b.x, b.y, b.width, b.height];
      } catch {
        /* not rendered */
      }
    });
    setLabelBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [ready, geo, fontsIn, regionCount]);
  /** where each region's name is drawn: its anchor, plus a nudge (map units) out from under the HUD */
  const labelAt = (sh: Shape): { lp: Pt; y: number; foreign: boolean } => {
    const foreign = sh.foreign ?? FOREIGN.has(sh.id);
    const split = Math.hypot(sh.label[0] - sh.seat[0], sh.label[1] - sh.seat[1]) > 60 * k;
    return { lp: foreign || split ? sh.label : sh.seat, y: foreign || split ? 8 : -20, foreign };
  };
  const placements: Record<string, { dx: number; dy: number; hidden: boolean }> = {};
  if (layout && hud) {
    const screen = rect(0, 0, box.w, box.h);
    const maxDist = Math.max(90, Math.min(box.w, box.h) * 0.3);
    const fixed: Rect[] = [];
    const pending: { id: string; lb: Rect; region: Rect }[] = [];
    for (const sh of geo.shapes) {
      const name = state.regions[sh.id]?.name;
      if (!name) continue;
      const { lp, y, foreign } = labelAt(sh);
      const fs = foreign ? 30 : 25;
      const ew = name.length * fs * (foreign ? 1.5 : 1.18);
      const [bx, by, bw, bh] = labelBoxes[sh.id] ?? [-ew / 2, y - fs, ew, fs * 1.3];
      const l = t.x + (lp[0] + bx * G) * t.s;
      const tp = t.y + (lp[1] + by * G) * t.s;
      const lb = rect(l, tp, l + bw * G * t.s, tp + bh * G * t.s);
      // a name whose anchor has been dragged off screen goes with its region
      const ax = t.x + lp[0] * t.s;
      const ay = t.y + lp[1] * t.s;
      if (!inside(rect(ax, ay, ax, ay), screen)) {
        placements[sh.id] = { dx: 0, dy: 0, hidden: true };
        continue;
      }
      if (inside(lb, layout.bounds) && !hud.obs.some((o) => hits(lb, o))) {
        placements[sh.id] = { dx: 0, dy: 0, hidden: false };
        fixed.push(lb);
        continue;
      }
      const region = rect(t.x + sh.bbox.l * t.s, t.y + sh.bbox.t * t.s, t.x + sh.bbox.r * t.s, t.y + sh.bbox.b * t.s);
      pending.push({ id: sh.id, lb, region });
    }
    // names under the HUD move inward: clear of the HUD, preferably of the other names too, and
    // still within their own region; failing that they fade out
    for (const { id, lb, region } of pending) {
      const ok = (d: [number, number] | null) => {
        if (!d) return false;
        const cx = (lb.l + lb.r) / 2 + d[0];
        const cy = (lb.t + lb.b) / 2 + d[1];
        return cx >= region.l && cx <= region.r && cy >= region.t && cy <= region.b;
      };
      let d = nudge(lb, layout.bounds, [...hud.obs, ...fixed.map((f) => grow(f, 2))], maxDist);
      if (!ok(d)) d = nudge(lb, layout.bounds, hud.obs, maxDist);
      if (d && ok(d)) {
        placements[id] = { dx: d[0] / t.s, dy: d[1] / t.s, hidden: false };
        fixed.push(shift(lb, d[0], d[1]));
      } else placements[id] = { dx: 0, dy: 0, hidden: true };
    }
  }

  // ---- hover card: beside the hovered region, clear of the HUD
  const cursor = useRef<[number, number]>([0, 0]);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const placeTip = useCallback(() => {
    const el = tipRef.current;
    const root = rootRef.current;
    const id = hoverRef.current;
    if (!el || !root || !id) return;
    const host = root.getBoundingClientRect();
    const shape = geo.shapes.find((x) => x.id === id);
    const avoid = shape ? rect(t.x + shape.bbox.l * t.s, t.y + shape.bbox.t * t.s, t.x + shape.bbox.r * t.s, t.y + shape.bbox.b * t.s) : null;
    // an open region card is HUD for the tip too
    const obs = [...(hud?.obs ?? []), ...measureHud(root.closest('.desk') ?? document, host, '.region-card').map((o) => grow(o, HUD_PAD))];
    const names = [...root.querySelectorAll('text.region-name:not(.is-hidden)')].map((n) => {
      const r = n.getBoundingClientRect();
      return rect(r.left - host.left, r.top - host.top, r.right - host.left, r.bottom - host.top);
    });
    const [x, y] = placeCard(el.offsetWidth || 250, el.offsetHeight || 120, cursor.current, avoid, rect(EDGE, EDGE, host.width - EDGE, host.height - EDGE), obs, names);
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }, [geo, t.x, t.y, t.s, hud]);
  useLayoutEffect(() => {
    if (hover) placeTip();
  }, [hover, placeTip]);
  const moveTip = (e: MouseEvent) => {
    const host = rootRef.current?.getBoundingClientRect();
    if (!host) return;
    cursor.current = [e.clientX - host.left, e.clientY - host.top];
    placeTip();
  };

  const hovered = hover ? state.regions[hover] : null;
  // ---- 兵部 overlay: where the selected army is, how long to each region, the road to the target
  const focusArmy = army?.army ? state.armies?.[army.army] : null;
  const home = focusArmy ? focusArmy.region : null;
  const routeTo = army && home ? (army.target && army.target !== home ? army.target : hover && hover !== home && etas?.[hover] != null ? hover : null) : null;
  const routeIds = routeTo && home ? travelPath(state.regions, home, routeTo) : null;
  const routePts: Pt[] = (routeIds ?? []).map((id) => seatOf[id]).filter(Boolean);
  const armyMode = Boolean(army?.army && etas);
  const canalBlocked = CANAL_REGIONS.some((id) => state.regions[id]?.controller === 'yan');
  const canalPts: Pt[] = geo.mode === 'schematic' && !mapData ? CANAL : CANAL_REGIONS.slice().map((id) => seatOf[id]).filter(Boolean);
  const rebelPts: Pt[] = REBEL_PATH.map((id) => seatOf[id]).filter(Boolean);
  const showRebel = rebelled || crisisValue >= 40 || layer === 'beacon';

  return (
    <div
      ref={rootRef}
      className={cls('map-root', `map-layer--${layer}`, drag.current?.moved && 'is-dragging', armyMode && 'is-army-mode')}
      data-testid="map.root"
      data-map-mode={geo.mode}
      data-layer={layer}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {layout && shown && (
        // Zoom controls sit on the sea in the fitted frame's bottom-right corner.
        <div
          className="map-zoom"
          data-testid="map.zoom"
          style={{
            left: layout.fit.x + geo.width * layout.fit.s - 12,
            top: layout.fit.y + geo.height * layout.fit.s - 12,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <span className="map-zoom-hint">滚轮缩放 · 按住左键拖动</span>
          <button type="button" data-testid="map.zoomIn" aria-label="放大" onClick={() => zoomAt(1.3, box.w / 2, box.h / 2)}>＋</button>
          <button type="button" data-testid="map.zoomOut" aria-label="缩小" onClick={() => zoomAt(1 / 1.3, box.w / 2, box.h / 2)}>－</button>
          <button
            type="button"
            data-testid="map.zoomReset"
            aria-label="复位"
            onClick={() => {
              userMoved.current = false;
              setTf({ ...layout.fit, key: geoKey });
              setEasing(true);
              window.clearTimeout(easeTimer.current);
              easeTimer.current = window.setTimeout(() => setEasing(false), 700);
            }}
          >
            复位
          </button>
        </div>
      )}
      <div
        className={cls('map-stage', shown && 'is-shown', easing && 'is-easing')}
        data-testid="map.stage"
        data-scale={t.s.toFixed(4)}
        data-fit-scale={layout ? layout.fit.s.toFixed(4) : undefined}
        style={{ width: geo.width, height: geo.height, transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, ['--inv' as string]: 1 / t.s }}
      >
      {baseUrl ? (
        <svg className="map-base" viewBox={`0 0 ${geo.width} ${geo.height}`} preserveAspectRatio="none" aria-hidden="true">
          <image
            href={baseUrl}
            width={geo.width}
            height={geo.height}
            preserveAspectRatio="none"
            onLoad={(e) => {
              if (mapData) return;
              const img = new Image();
              img.onload = () => setImgSize([img.naturalWidth, img.naturalHeight]);
              img.src = (e.target as SVGImageElement).href.baseVal;
            }}
          />
        </svg>
      ) : ready ? (
        <SchematicBase />
      ) : null}
      {ready && (
        <svg className="map-overlay" viewBox={`0 0 ${geo.width} ${geo.height}`} preserveAspectRatio="none">
          <defs>
            <pattern id="mo-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="9" stroke="#3d342b" strokeOpacity="0.35" strokeWidth="1.4" />
            </pattern>
            <clipPath id="mo-land">{geo.mode === 'schematic' && !mapData ? <path d={LAND_PATH} /> : <rect width={geo.width} height={geo.height} />}</clipPath>
            <filter id="mo-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <radialGradient id="mo-fire">
              <stop offset="0%" stopColor="#ffd27a" />
              <stop offset="45%" stopColor="#e2582f" />
              <stop offset="100%" stopColor="#c0392b" stopOpacity="0" />
            </radialGradient>
            <marker id="mo-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#b2321f" />
            </marker>
            <marker id="mo-route-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#f2d27a" />
            </marker>
          </defs>
          <g clipPath="url(#mo-land)">
            {geo.shapes
              .filter((s) => s.d)
              .map((s) => {
                const { fill, opacity } = layerFill(layer, s.id, state, crisisValue, armiesBy);
                return (
                  <g key={s.id}>
                    <path className="region-fill" d={s.d} style={{ fill, fillOpacity: geo.mode === 'schematic' ? opacity : Math.min(0.85, opacity * 1.7) }} />
                    {FOREIGN.has(s.id) && <path d={s.d} fill="url(#mo-hatch)" pointerEvents="none" />}
                  </g>
                );
              })}
            {/* circuit borders: cinnabar dotted lines as on period maps */}
            {geo.shapes
              .filter((s) => s.d)
              .map((s) => (
                <path key={`b${s.id}`} d={s.d} className="region-border" />
              ))}
          </g>

          {/* canal lifeline */}
          {(layer === 'canal' || canalBlocked) && canalPts.length > 1 && (
            <g className={cls('canal', canalBlocked && 'canal--blocked')} data-testid="map.canalRoute">
              <path d={smoothPath(canalPts)} className="canal-under" />
              <path d={smoothPath(canalPts)} className="canal-line" />
            </g>
          )}

          {/* rebel route */}
          {showRebel && rebelPts.length > 1 && (
            <g className={cls('rebel-route', rebelled && 'rebel-route--live')} data-testid="map.rebelRoute">
              <path d={smoothPath(rebelPts)} className="rebel-under" />
              <path d={smoothPath(rebelPts)} className="rebel-line" markerEnd="url(#mo-arrow)" />
            </g>
          )}

          {/* beacons (烽燧) */}
          {(layer === 'beacon' || crisisValue >= 40) &&
            ['fanyang', 'pinglu', 'hebei', 'duji', 'tongguan'].map((id, i) => {
              const p = seatOf[id];
              if (!p) return null;
              const heat = Math.max(0.25, Math.min(1, (crisisValue - 20) / 70 - i * 0.08));
              return (
                <g key={`f${id}`} transform={`translate(${p[0] + 38 * G} ${p[1] - 30 * G}) scale(${G})`} className="beacon" style={{ animationDelay: `${i * 0.37}s` }}>
                  <circle r={22 * heat + 8} fill="url(#mo-fire)" opacity={0.85} />
                  <path d="M-5 10 L -3 -2 L 3 -2 L 5 10 Z" fill="#3d2a1c" />
                </g>
              );
            })}

          {/* hit areas */}
          {geo.shapes.map((s) => {
            const region = state.regions[s.id];
            if (!region) return null;
            const common = {
              'data-testid': `map.region.${s.id}`,
              className: cls('region-hit', selected === s.id && 'is-selected'),
              onMouseEnter: (e: MouseEvent) => {
                if (drag.current?.moved) return;
                moveTip(e);
                setHover(s.id);
              },
              onMouseLeave: () => setHover((h) => (h === s.id ? null : h)),
              onMouseMove: moveTip,
              onClick: () => {
                if (armyMode) {
                  if (etas?.[s.id] != null && s.id !== home) onPickTarget?.(s.id);
                  return;
                }
                onSelect(selected === s.id ? null : s.id);
              },
              role: 'button',
              'aria-label': region.name,
            };
            return s.d ? <path key={`h${s.id}`} d={s.d} {...common} /> : <circle key={`h${s.id}`} cx={s.seat[0]} cy={s.seat[1]} r={46 * k} {...common} />;
          })}

          {/* labels */}
          {geo.shapes.map((s) => {
            const region = state.regions[s.id];
            if (!region) return null;
            const capital = s.id === 'jingji' || s.id === 'duji';
            const { lp, y: ly, foreign } = labelAt(s);
            const nudged = placements[s.id] ?? { dx: 0, dy: 0, hidden: false };
            return (
              <g key={`l${s.id}`} className={cls('region-label', foreign && 'is-foreign', selected === s.id && 'is-selected')} pointerEvents="none">
                {!foreign && (
                  <g transform={`translate(${s.seat[0]} ${s.seat[1]}) scale(${G})`}>
                    <g className="seat-mark">
                      {capital ? (
                        <g transform="translate(0 2)">
                          <path d="M-13 -4 L 0 -13 L 13 -4 Z" fill="#7a2a1e" />
                          <rect x="-10" y="-4" width="20" height="9" fill="#c9a24b" stroke="#3a2210" strokeWidth="1.2" />
                          <rect x="-3" y="0" width="6" height="5" fill="#3a2210" />
                        </g>
                      ) : (
                        <rect x="-4.5" y="-4.5" width="9" height="9" transform="rotate(45)" fill="#8a2219" stroke="#f2e6c6" strokeWidth="1.4" />
                      )}
                    </g>
                    {(region.seat ?? SEAT_NAMES[s.id]) && (region.seat ?? SEAT_NAMES[s.id]) !== region.name && (
                      <text className="seat-name" y={22} textAnchor="middle">
                        {region.seat ?? SEAT_NAMES[s.id]}
                      </text>
                    )}
                  </g>
                )}
                <text
                  className={cls('region-name', nudged.hidden && 'is-hidden')}
                  data-label={s.id}
                  data-testid={`map.label.${s.id}`}
                  data-anchor={`${Math.round(lp[0])},${Math.round(lp[1])}`}
                  data-nudged={nudged.dx || nudged.dy ? '1' : undefined}
                  transform={`translate(${lp[0] + nudged.dx} ${lp[1] + nudged.dy}) scale(${G})`}
                  y={ly}
                  textAnchor="middle"
                >
                  {region.name}
                </text>
              </g>
            );
          })}

          {/* 兵部: travel times from the selected army, and the road to the chosen destination */}
          {armyMode && home && seatOf[home] && (
            <g className="army-plan" data-testid="map.armyPlan" pointerEvents="none">
              {geo.shapes.map((sh) => {
                const eta = etas?.[sh.id];
                if (eta == null || sh.id === home || !state.regions[sh.id]) return null;
                const p = sh.seat;
                const on = routeTo === sh.id;
                return (
                  <g key={`eta${sh.id}`} className={cls('eta-tag', on && 'is-on', eta >= 3 && 'is-far')} transform={`translate(${p[0] - (eta >= 10 ? 60 : 52) * G} ${p[1] + 1 * G}) scale(${G})`} data-testid={`map.eta.${sh.id}`}>
                    <rect x="-2" y="-12" width={eta >= 10 ? 46 : 38} height="19" rx="9.5" />
                    <text x={eta >= 10 ? 21 : 17} y="2.5" textAnchor="middle" className="t-num">{`${eta}季`}</text>
                  </g>
                );
              })}
              {routePts.length > 1 && (
                <g className={cls('army-route', army?.target === routeTo && 'is-chosen')} data-testid="map.armyRoute" data-to={routeTo ?? ''}>
                  <path d={smoothPath(routePts)} className="army-route-under" />
                  <path d={smoothPath(routePts)} className="army-route-line" markerEnd="url(#mo-route-arrow)" />
                </g>
              )}
              <g transform={`translate(${seatOf[home][0]} ${seatOf[home][1]}) scale(${G})`} className="army-home">
                <circle r="26" className="army-home-ring" />
                <circle r="16" className="army-home-ring army-home-ring--inner" />
              </g>
              {routeTo && seatOf[routeTo] && etas?.[routeTo] != null && (
                <g transform={`translate(${seatOf[routeTo][0]} ${seatOf[routeTo][1] - 44 * G}) scale(${G})`} className="route-eta">
                  <rect x="-58" y="-16" width="116" height="26" rx="4" />
                  <text y="3" textAnchor="middle">{`${state.regions[routeTo]?.name ?? ''} · 约${etas[routeTo]}季`}</text>
                </g>
              )}
            </g>
          )}

          {/* army tokens */}
          {Object.entries(armiesBy).map(([rid, list]) => {
            const p = seatOf[rid];
            if (!p) return null;
            return list.slice(0, 3).map((a, i) => {
              const hostile = a.faction === 'yan';
              const foreign = a.faction && a.faction !== 'tang' && !hostile;
              const shape = geo.shapes.find((x) => x.id === rid);
              return (
                <g
                  key={a.id}
                  className={cls('army-token', hostile && 'is-rebel', foreign && 'is-foreign', a.in_transit && 'is-moving')}
                  transform={`translate(${p[0] + ((shape?.foreign ?? FOREIGN.has(rid)) ? -30 : 14) * G} ${p[1] + ((shape?.foreign ?? FOREIGN.has(rid)) ? 26 : -2) * G + i * 22 * G}) scale(${G})`}
                  data-testid={`map.army.${a.id}`}
                >
                  <title>{`${a.name}　${a.strength.toLocaleString('zh-CN')}人${transit(a.in_transit) ? `（行军${transit(a.in_transit)}）` : ''}`}</title>
                  <rect x="0" y="-10" width="60" height="19" rx="3" />
                  <circle cx="9" cy="-0.5" r="4.5" className="army-dot" />
                  <text x="36" y="4.5" textAnchor="middle" className="t-num">
                    {fmtWan(a.strength)}
                  </text>
                </g>
              );
            });
          })}
        </svg>
      )}
      </div>
      {!ready && <div className="map-loading ink-loader"><i /><i /><i /> 展舆图</div>}
      <div ref={tipRef} className={cls('map-tip lacquer', hovered && 'is-on')} aria-hidden={!hovered}>
        {hovered && (
          <>
            <h4 className="t-title">
              {hovered.name}
              {(hovered.seat ?? SEAT_NAMES[hovered.id]) && <small>　治{hovered.seat ?? SEAT_NAMES[hovered.id]}</small>}
            </h4>
            {hovered.stats && Object.keys(hovered.stats).length > 0 ? (
              <div className="map-tip-stats">
                {Object.entries(hovered.stats).map(([k2, v]) => (
                  <span key={k2}>
                    {({ prosperity: '繁荣', order: '治安', defense: '防务', tax: '税基', grain: '粮产' } as Record<string, string>)[k2] ?? k2}
                    <b className="t-num">{Math.round(v)}</b>
                  </span>
                ))}
              </div>
            ) : (
              <div className="map-tip-note">域外之国</div>
            )}
            {(armiesBy[hovered.id] ?? []).map((a) => (
              <div key={a.id} className="map-tip-army">
                {a.name}　<span className="t-num">{a.strength.toLocaleString('zh-CN')}</span>
                {transit(a.in_transit) && <small>　行军{transit(a.in_transit)}</small>}
              </div>
            ))}
            {Object.values(state.characters ?? {})
              .filter((c) => c.in_transit && c.region === hovered.id && c.status !== 'dead')
              .map((c) => (
                <div key={c.id} className="map-tip-army map-tip-traveller">
                  {c.name}　<small>{transit(c.in_transit)}</small>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
