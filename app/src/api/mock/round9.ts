// Mock of the engine's round-9 rules (docs/CONTRACT.md §7): presence in the capital, courier
// dates, policy cards with filtered parameter options, the 兵部 army table and autonomy risk.
// Deliberately simple; it mirrors the shapes the real engine returns, not its every rule.
import type { ArmiesResponse, ArmyInfo, Character, Op, PolicyCard, PresentResponse, PublicState } from '../types';
import { travelTimes } from '../../lib/route';
import { db } from './db';
import { evalCond, evalExpr } from './scenario';

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);

export const PLAYER = 'xuanzong';
export const playerFaction = (s: PublicState) => String((s.rules?.player_faction as string) ?? 'tang');
export const capitalOf = () => String((db.settings.capital_region as string) ?? 'jingji');
const regionName = (s: PublicState, id: string | null | undefined) => (id ? s.regions[id]?.name ?? id : '');

export function agendaLimits(): { audience: number | null; debate: number | null } {
  const a = (db.settings.agenda ?? {}) as Obj;
  return {
    audience: a.audience_per_season == null ? null : Number(a.audience_per_season),
    debate: a.debate_per_season == null ? null : Number(a.debate_per_season),
  };
}

/** 「在途：A→B，约n季后到」 for anything with an in_transit record. */
export function transitText(s: PublicState, region: string, t: Obj | null | undefined): string | null {
  if (!t || typeof t.to_region !== 'string') return null;
  const eta = typeof t.eta_turn === 'number' ? Math.max(1, t.eta_turn - s.turn) : 1;
  return `在途：${regionName(s, String(t.from_region ?? region))}→${regionName(s, t.to_region)}，约${eta}季后到`;
}

// ---------------------------------------------------------------- presence (§7.2)
export function present(s: PublicState): PresentResponse {
  const cap = capitalOf();
  const faction = playerFaction(s);
  const officeNames = (c: Character) => (c.offices ?? []).map((o) => s.offices?.[o]?.name ?? o);
  const people = Object.values(s.characters).filter((c) => c.id !== PLAYER && (c.status ?? 'alive') === 'alive' && (c.faction ?? faction) === faction);
  const row = (c: Character) => {
    const transit = transitText(s, c.region, c.in_transit as Obj | null);
    const here = c.region === cap && !transit;
    return {
      character: c.id,
      name: c.name,
      present: here,
      region: c.region,
      region_name: regionName(s, c.region),
      in_transit: transit,
      whereabouts: transit ?? (here ? `在${regionName(s, cap)}` : `在${regionName(s, c.region)}`),
      offices: officeNames(c),
    };
  };
  const rows = people.map(row);
  return { capital: { id: cap, name: regionName(s, cap) }, present: rows.filter((r) => r.present), absent: rows.filter((r) => !r.present) };
}

export function isPresent(s: PublicState, id: string): boolean {
  const c = s.characters[id];
  return Boolean(c && c.region === capitalOf() && !c.in_transit && (c.status ?? 'alive') === 'alive');
}

// ---------------------------------------------------------------- courier (§7.3)
export function courierDays(s: PublicState, region: string | null | undefined): number {
  if (!region) return 1;
  const r = s.regions[region];
  if (r?.courier_days != null) return r.courier_days;
  const turns = travelTimes(s.regions, capitalOf())[region];
  return turns == null ? 70 : turns <= 0 ? 3 : turns === 1 ? 15 : turns === 2 ? 40 : 70;
}
export const lateThreshold = () => Number(((db.settings.courier ?? {}) as Obj).late_threshold_days ?? 60);

const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const DAY = (d: number) => {
  const units = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (d <= 10) return `初${units[d]}`;
  if (d < 20) return `十${units[d - 10]}`;
  if (d === 20) return '二十';
  if (d < 30) return `廿${units[d - 20]}`;
  return '三十';
};
/** 「四月初七日自范阳奏到」: season's first month plus the courier days (30-day months). */
export function arrivalText(s: PublicState, region: string, offset = 0): string {
  const days = courierDays(s, region) + offset;
  const start = (s.turn % 4) * 3;
  const month = (start + Math.floor(days / 30)) % 12;
  const day = (days % 30) + 1;
  return `${MONTHS[month]}${DAY(day)}日自${regionName(s, region)}奏到`;
}

// ---------------------------------------------------------------- autonomy (§7.5)
export function autonomyProb(s: PublicState, armyId: string, order: string): number | null {
  const a = s.armies?.[armyId];
  if (!a?.commander) return null;
  const c = s.characters[a.commander];
  if (!c) return null;
  const cfg = (db.settings.autonomy ?? {}) as Obj;
  const byOrder = (cfg.by_order ?? {}) as Record<string, string>;
  const formula = byOrder[order] ?? (cfg.formula as string | undefined) ?? 'min(0.6, 0.06 * max(0, 6 - loyalty) + 0.04 * max(0, ambition - 6) + 0.02 * max(0, rashness - 5))';
  return evalExpr(formula, (n) => Number(c.traits?.[n] ?? (n === 'present' ? Number(c.region === a.region) : n === 'strength' ? a.strength / 10000 : 0)));
}
export function riskLevel(p: number | null): '低' | '中' | '高' | null {
  if (p == null) return null;
  const levels = (((db.settings.autonomy ?? {}) as Obj).levels as number[] | undefined) ?? [0.1, 0.3];
  return p < levels[0] ? '低' : p < levels[1] ? '中' : '高';
}

// ---------------------------------------------------------------- policy cards (§7.4)
function options(s: PublicState, kind: string, filter: Obj = {}): { id: string; name: string; note?: string }[] {
  const faction = playerFaction(s);
  const cap = capitalOf();
  switch (kind) {
    case 'army':
      return Object.values(s.armies ?? {})
        .filter((a) => (a.faction ?? faction) === faction && a.strength > 0)
        .filter((a) => !filter.idle || !a.in_transit)
        .filter((a) => filter.min_strength == null || a.strength >= Number(filter.min_strength))
        .map((a) => ({ id: a.id, name: a.name, note: `兵 ${Math.round(a.strength)}；${a.in_transit ? '在途' : `驻${regionName(s, a.region)}`}` }));
    case 'region': {
      const ids = Array.isArray(filter.ids) ? (filter.ids as string[]) : null;
      return Object.values(s.regions)
        .filter((r) => !ids || ids.includes(r.id))
        .filter((r) => filter.controller !== 'own' || (r.controller ?? faction) === faction)
        .filter((r) => filter.controller !== 'enemy' || (r.controller ?? faction) !== faction)
        .filter((r) => !filter.not_capital || r.id !== cap)
        .map((r) => ({ id: r.id, name: r.name, note: `归${s.factions?.[r.controller ?? faction]?.name ?? '唐廷'}` }));
    }
    case 'character':
      return Object.values(s.characters)
        .filter((c) => c.id !== PLAYER && (c.status ?? 'alive') === 'alive' && (c.faction ?? faction) === faction)
        .filter((c) => filter.present === undefined || (c.region === cap) === Boolean(filter.present))
        .filter((c) => !filter.idle || !c.in_transit)
        .filter((c) => !filter.holds_office || (c.offices ?? []).length > 0)
        .map((c) => ({ id: c.id, name: c.name, note: [...(c.offices ?? []).map((o) => s.offices?.[o]?.name ?? o)].join('、') + `${(c.offices ?? []).length ? '；' : ''}${regionName(s, c.region)}` }));
    case 'office': {
      const ids = Array.isArray(filter.ids) ? (filter.ids as string[]) : null;
      return Object.values(s.offices ?? {})
        .filter((o) => !ids || ids.includes(o.id))
        .filter((o) => !filter.vacant || !o.holder)
        .map((o) => ({ id: o.id, name: o.name, note: o.holder ? `现任：${s.characters[o.holder]?.name ?? ''}` : '出缺' }));
    }
    case 'choice':
      return arr(filter.choices).map((c) => ({ id: String(c.id), name: String(c.name ?? c.id) }));
    default:
      return [];
  }
}

export function cardRow(id: string): Obj | undefined {
  return db.policyCards.find((c) => c.id === id);
}

export function cardsFor(s: PublicState): PolicyCard[] {
  return db.policyCards.map((row) => {
    const cooldown = Number(row.cooldown ?? 0);
    const used = s.flags?.[`card:${row.id}`];
    const cooldownLeft = typeof used === 'number' && cooldown ? Math.max(0, cooldown - (s.turn - used)) : 0;
    const reqOk = row.requires ? evalCond(row.requires, s) : true;
    const reason = !reqOk ? '条件未备：乱起之后可用' : cooldownLeft > 0 ? `冷却中，尚余 ${cooldownLeft} 季` : '';
    return {
      id: String(row.id),
      category: String(row.category ?? '内政'),
      title: String(row.title ?? row.id),
      summary: String(row.summary ?? ''),
      cost_hint: String(row.cost_hint ?? ''),
      cooldown,
      cooldown_left: cooldownLeft,
      available: !reason,
      unavailable_reason: reason,
      illustration: null,
      params: arr(row.params).map((p) => {
        const kind = String(p.kind);
        const label = String(p.label ?? { character: '人物', office: '官职', army: '军队', region: '地区', amount: '数额', choice: '选项' }[kind] ?? p.name);
        if (kind === 'amount') return { name: String(p.name), kind, label, min: Number(p.min ?? 0), max: Number(p.max ?? 100), default: p.default == null ? null : Number(p.default) };
        return { name: String(p.name), kind, label, options: options(s, kind, { ...((p.filter as Obj) ?? {}), choices: p.choices }) };
      }),
    };
  });
}

/** Fills a card's op templates: "{param}" → the value (keeps numbers), "{param.name}" → display name. */
export function expandCard(s: PublicState, row: Obj, params: Record<string, unknown>): Op[] {
  const nameOf = (id: string) => s.characters[id]?.name ?? s.armies?.[id]?.name ?? s.regions[id]?.name ?? s.offices?.[id]?.name ?? id;
  const fill = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const whole = v.match(/^\{(\w+)\}$/);
      if (whole) return params[whole[1]];
      return v.replace(/\{(\w+)(\.name)?\}/g, (_m, k: string, dotName?: string) => (dotName ? nameOf(String(params[k] ?? '')) : String(params[k] ?? '')));
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Obj).map(([k, x]) => [k, fill(x)]));
    return v;
  };
  return arr(row.ops).map((op) => fill(op) as Op);
}

/** The region a clause acts on (army station, person's whereabouts, project region) for 令达. */
export function opRegion(s: PublicState, op: Op): string | null {
  if (op.army && s.armies?.[String(op.army)]) return s.armies[String(op.army)].region;
  if (op.character && s.characters[String(op.character)] && ['appoint', 'dismiss', 'move_character', 'set_character_status'].includes(String(op.op))) return s.characters[String(op.character)].region;
  if (op.op === 'start_project' && op.region) return String(op.region);
  return null;
}

// ---------------------------------------------------------------- 兵部 (§7.5)
const POSTURE: Record<string, string> = { hold: '坚守', attack: '进击', scorch: '坚壁清野' };
export function armies(s: PublicState): ArmiesResponse {
  const faction = playerFaction(s);
  const cards = cardsFor(s).filter((c) => c.category === '军务');
  const list: ArmyInfo[] = Object.values(s.armies ?? {})
    .filter((a) => (a.faction ?? faction) === faction && a.strength > 0)
    .map((a) => {
      const t = a.in_transit as Obj | null;
      const transit = transitText(s, a.region, t);
      const cmd = a.commander ? s.characters[a.commander] : null;
      const here = Boolean(cmd && cmd.region === a.region && !cmd.in_transit);
      const etas: Record<string, number | null> = {};
      const times = travelTimes(s.regions, a.region);
      for (const id of Object.keys(s.regions)) etas[id] = times[id] ?? null;
      return {
        id: a.id,
        name: a.name,
        strength: a.strength,
        quality: a.quality ?? 1,
        commander: cmd ? { id: cmd.id, name: cmd.name, present: here, note: here ? `主帅${cmd.name}在营` : `主帅${cmd.name}遥领，不在军中（今在${regionName(s, cmd.region)}），由副将暂摄` } : null,
        region: a.region,
        region_name: regionName(s, a.region),
        in_transit: transit,
        destination: t ? String(t.to_region) : null,
        eta_turn: t && typeof t.eta_turn === 'number' ? t.eta_turn : null,
        whereabouts: transit ?? `驻${regionName(s, a.region)}`,
        posture: a.posture ?? null,
        posture_label: POSTURE[a.posture ?? ''] ?? '常态',
        orders: t ? ['set_army_posture', 'set_army_commander'] : ['march', 'detach', 'set_army_posture', 'set_army_commander'],
        cards: cards.filter((c) => !c.params.some((p) => p.kind === 'army') || c.params.some((p) => p.kind === 'army' && p.options?.some((o) => o.id === a.id))).map((c) => c.id),
        autonomy_risk: riskLevel(autonomyProb(s, a.id, 'march')),
        etas,
      };
    });
  return { armies: list, regions: Object.values(s.regions).map((r) => ({ id: r.id, name: r.name, controller: r.controller ?? faction })), turn_unit: '季' };
}
