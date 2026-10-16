// Mock-mode helpers that read the real scenario (scenarios/tianbao_751/*.yaml, served as JSON
// by the dev-server plugin) so the mock shows the actual memorials, characters and events.
// Includes a tiny formula evaluator and a subset of the CONTRACT §1.4 condition DSL.
import type { PublicState } from '../types';

export interface ScenarioBundle {
  scenario?: Record<string, unknown>;
  characters?: Record<string, unknown>[];
  regions?: Record<string, unknown>[];
  armies?: Record<string, unknown>[];
  factions?: Record<string, unknown>[];
  memorials?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  policy_cards?: Record<string, unknown>[];
}

let bundlePromise: Promise<ScenarioBundle | null> | null = null;
export function loadScenarioBundle(): Promise<ScenarioBundle | null> {
  if (!bundlePromise) {
    bundlePromise = fetch('/mock-assets/scenario.json')
      .then((r) => (r.ok ? (r.json() as Promise<ScenarioBundle>) : null))
      .catch(() => null);
  }
  return bundlePromise;
}

// ---------------------------------------------------------------- formula evaluator
type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
    } else {
      out.push({ t: 'op', v: c });
      i++;
    }
  }
  return out;
}

export function evalExpr(src: string, vars: (name: string) => number): number {
  const toks = tokenize(String(src));
  let p = 0;
  const peek = () => toks[p];
  const take = () => toks[p++];
  const expr = (): number => {
    let v = term();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = take().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = take().v;
      const r = factor();
      v = op === '*' ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  };
  const factor = (): number => {
    const tk = take();
    if (!tk) return 0;
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'op' && tk.v === '-') return -factor();
    if (tk.t === 'op' && tk.v === '+') return factor();
    if (tk.t === 'op' && tk.v === '(') {
      const v = expr();
      take();
      return v;
    }
    if (tk.t === 'id') {
      if (peek()?.t === 'op' && peek().v === '(') {
        take();
        const args = [expr()];
        while (peek()?.t === 'op' && peek().v === ',') {
          take();
          args.push(expr());
        }
        take();
        if (tk.v === 'max') return Math.max(...args);
        if (tk.v === 'min') return Math.min(...args);
        if (tk.v === 'abs') return Math.abs(args[0]);
        return 0;
      }
      return vars(tk.v);
    }
    return 0;
  };
  try {
    const v = expr();
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- condition DSL subset
function cmp(a: unknown, op: string | undefined, b: unknown): boolean {
  switch (op ?? 'eq') {
    case 'gt':
      return Number(a) > Number(b);
    case 'gte':
      return Number(a) >= Number(b);
    case 'lt':
      return Number(a) < Number(b);
    case 'lte':
      return Number(a) <= Number(b);
    case 'exists':
      return a !== undefined && a !== null && a !== false;
    case 'absent':
      return a === undefined || a === null || a === false;
    default:
      return a === b || (a == null && b === false) || String(a) === String(b);
  }
}

export function evalCond(cond: unknown, s: PublicState): boolean {
  if (!cond || typeof cond !== 'object') return true;
  const c = cond as Record<string, unknown>;
  if (Array.isArray(c.all)) return c.all.every((x) => evalCond(x, s));
  if (Array.isArray(c.any)) return c.any.some((x) => evalCond(x, s));
  if ('not' in c) return !evalCond(c.not, s);
  const op = c.operator as string | undefined;
  switch (c.kind) {
    case 'turn':
      return cmp(s.turn, op, c.value);
    case 'resource':
      return cmp(s.resources[String(c.id ?? c.resource)]?.amount ?? 0, op, c.value);
    case 'flag': {
      const v = s.flags?.[String(c.key)];
      if (op === 'exists' || op === 'absent') return cmp(v, op, null);
      return cmp(v ?? false, op, c.value ?? true);
    }
    case 'flag_age': {
      const t = s.flag_turns?.[String(c.key)];
      if (t == null) return false;
      return cmp(s.turn - t, op, c.value);
    }
    case 'counter':
      return cmp(s.counters?.[String(c.key)] ?? 0, op, c.value);
    case 'region_stat':
      return cmp(s.regions[String(c.region)]?.stats?.[String(c.stat)] ?? 0, op, c.value);
    case 'region_controller':
      return cmp(s.regions[String(c.region)]?.controller ?? 'tang', op ?? 'eq', c.faction);
    case 'character_status':
      return cmp(s.characters[String(c.character)]?.status ?? 'alive', op ?? 'eq', c.value);
    case 'character_trait':
      return cmp(s.characters[String(c.character)]?.traits?.[String(c.trait)] ?? 0, op, c.value);
    case 'character_region':
      return cmp(s.characters[String(c.character)]?.region, op ?? 'eq', c.region);
    case 'office_holder': {
      const holder = Object.values(s.characters).find((ch) => (ch.offices ?? []).includes(String(c.office)) || ch.office === c.office);
      return cmp(holder?.id ?? null, op ?? 'eq', c.character ?? null);
    }
    case 'army_strength': {
      const armies = Object.values(s.armies ?? {});
      const total = c.army ? s.armies?.[String(c.army)]?.strength ?? 0 : armies.filter((a) => a.faction === c.faction).reduce((t, a) => t + a.strength, 0);
      return cmp(total, op, c.value);
    }
    case 'relation': {
      const rel = s.factions?.[String(c.a)]?.relations?.[String(c.b)] ?? 0;
      return cmp(rel, op, c.value);
    }
    default:
      return true;
  }
}
