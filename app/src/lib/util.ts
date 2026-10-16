// Small shared helpers: seeded RNG, deckled-edge clip paths, number formatting, op summaries.
import type { Op, PublicResource } from '../api/types';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function strSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const deckleCache = new Map<string, string>();
/** A clip-path polygon with torn/deckled paper edges that works at any element size. */
export function deckle(seed: number, amp = 4, steps = 36, sides: 'all' | 'lr' | 'tb' = 'all'): string {
  const key = `${seed}:${amp}:${steps}:${sides}`;
  const hit = deckleCache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const j = () => (rand() * amp).toFixed(1);
  const pts: string[] = [];
  const tb = sides !== 'lr';
  const lr = sides !== 'tb';
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(2)}% ${tb ? j() : 0}px`);
  for (let i = 1; i <= steps; i++) pts.push(`calc(100% - ${lr ? j() : 0}px) ${((i / steps) * 100).toFixed(2)}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(2)}% calc(100% - ${tb ? j() : 0}px)`);
  for (let i = steps - 1; i >= 1; i--) pts.push(`${lr ? j() : 0}px ${((i / steps) * 100).toFixed(2)}%`);
  const out = `polygon(${pts.join(',')})`;
  deckleCache.set(key, out);
  return out;
}

export function fmtNum(n: number | undefined | null, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  const v = Math.abs(n) >= 100 ? Math.round(n) : Number(n.toFixed(digits));
  return v.toLocaleString('zh-CN');
}

export function fmtDelta(n: number): string {
  const v = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  if (v === 0) return '±0';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('zh-CN')}`;
}

/**
 * A hidden value's range, compact: signed deltas "+0.3～+0.9", "−0.2～+0.4"; values "约 52–60".
 * When both ends round to the same number a single value is shown ("约 ±0", "约 +0.9", "约 55").
 * Callers render it in a `white-space: nowrap` element so it never wraps mid-range.
 */
export function fmtRange(lo: number, hi: number, signed = false, approx = true): string {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const one = (n: number) => (signed ? fmtDelta(n) : fmtNum(n, Math.abs(n) < 10 ? 1 : 0));
  const left = one(a);
  const right = one(b);
  const pre = approx ? '约 ' : '';
  if (left === right) return `${approx ? '约 ' : ''}${left}`;
  return signed ? `${left}～${right}` : `${pre}${left}–${right}`;
}

/** A number or a [lo, hi] estimate, formatted for display. */
export function fmtValueOrRange(v: number | [number, number] | null | undefined, signed = false): string {
  if (v == null) return '—';
  if (Array.isArray(v)) return fmtRange(v[0], v[1], signed);
  return signed ? fmtDelta(v) : fmtNum(v, Math.abs(v) < 10 ? 1 : 0);
}

export function fmtWan(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  return n.toLocaleString('zh-CN');
}

export function resourceValueText(r: PublicResource | undefined): string {
  if (!r) return '—';
  if (r.hidden && r.estimate) return fmtRange(Math.round(r.estimate[0]), Math.round(r.estimate[1]), false, false);
  return fmtNum(r.amount);
}

/** Higher-is-worse resources; used to colour deltas by consequence rather than sign. */
export const NEGATIVE_RESOURCES = new Set([
  'corruption',
  'frontier_pressure',
  'an_ambition',
  'fanzhen_power',
  'court_strife',
  'rebellion_risk',
]);

export function deltaClass(resource: string, delta: number): string {
  if (!delta) return '';
  const bad = NEGATIVE_RESOURCES.has(resource) ? delta > 0 : delta < 0;
  return delta > 0 ? (bad ? 'delta-up-bad' : 'delta-up-good') : bad ? 'delta-down-bad' : 'delta-down-good';
}

const STAT_NAMES: Record<string, string> = {
  prosperity: '繁荣',
  order: '治安',
  defense: '防务',
  tax: '税基',
  grain: '粮产',
};
export const statName = (id: string) => STAT_NAMES[id] ?? id;

/** Human summary of a StateOp for receipts and memorial options. Never shows raw ids for known kinds. */
export function opSummary(
  op: Op | null | undefined,
  names: { res?: (id: string) => string; ent?: (id: string) => string; hidden?: (id: string) => boolean } = {},
): string {
  if (!op) return '';
  const res = names.res ?? ((id: string) => id);
  if (op.op === 'adjust_resource' && names.hidden?.(String(op.resource))) {
    return `${res(String(op.resource))}${Number(op.delta) > 0 ? '↑' : '↓'}（风闻）`;
  }
  const ent = names.ent ?? ((id: string) => id);
  const d = Number(op.delta ?? 0);
  switch (op.op) {
    case 'adjust_resource':
      return `${res(String(op.resource))} ${fmtDelta(d)}`;
    case 'set_flag':
      return '';
    case 'start_project':
      return `兴工：${String(op.name ?? '')}（${String(op.turns ?? '?')}季）`;
    case 'adjust_army':
      return `${ent(String(op.army))} ${fmtDelta(d)}`;
    case 'adjust_region':
      return `${ent(String(op.region))}${statName(String(op.stat))} ${fmtDelta(d)}`;
    case 'move_character':
      return `${ent(String(op.character))} 赴 ${ent(String(op.region))}`;
    case 'appoint':
      return `任 ${ent(String(op.character))} 为 ${ent(String(op.office))}`;
    case 'dismiss':
      return `罢 ${ent(String(op.character))}`;
    case 'set_character_status':
      return `${ent(String(op.character))}：${String(op.status)}`;
    case 'adjust_relation':
      return `${ent(String(op.a))}与${ent(String(op.b))}关系 ${fmtDelta(d)}`;
    default:
      return op.op ? String(op.op) : '';
  }
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
