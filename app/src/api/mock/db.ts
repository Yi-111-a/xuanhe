// The mock's scenario tables: built-in fixture (from the outline) overlaid with the real
// scenario YAML when the dev server can read it.
import type { Army, Character, Faction, MemorialItem, Office, Op, Region } from '../types';
import {
  ARMIES,
  CHARACTERS,
  CRISIS_BANDS,
  ENDINGS,
  EVENTS,
  FACTIONS,
  MEMORIALS,
  OBJECTIVES,
  OFFICES,
  REGIONS,
  RESOURCES,
  type ResourceDef,
} from './data';
import { loadScenarioBundle } from './scenario';

export interface DbEvent {
  id: string;
  title: string;
  text: string;
  kind?: string;
  when?: { turn?: number };
  conditions?: unknown;
  gravity?: number;
  effects: Op[];
  choices?: { id: string; text: string; hint?: string; effects: Op[] }[];
  default_choice?: string;
  choice_deadline?: number;
  repeatable?: boolean;
  cooldown?: number;
  illustration?: string;
}

export interface DbEnding {
  id: string;
  kind: 'ending' | 'fail';
  title: string;
  text: string;
  priority: number;
  conditions?: unknown;
  illustration?: string;
}

export interface DbMemorial extends MemorialItem {
  conditions?: unknown;
  expires_after?: number;
}

export interface Db {
  loaded: 'fixture' | 'scenario';
  title: string;
  summary: string;
  categories: { id: string; name: string; hint?: string }[];
  resources: ResourceDef[];
  regions: Region[];
  characters: Character[];
  armies: Army[];
  factions: Faction[];
  offices: Office[];
  memorials: DbMemorial[];
  events: DbEvent[];
  endings: DbEnding[];
  objectives: { id: string; title: string; detail: string }[];
  bands: { max: number; name: string }[];
  crisisTitle: string;
  terms: { id: string; label: string; expr: string }[];
  drift: Record<string, string>;
  income: { resource: string; formula: string }[];
  counters: { id: string; mode: 'streak' | 'count'; conditions: unknown }[];
  ledger: { id: string; name: string; category: string; amount: number; kind: 'recurring'; reason: string; resource: string }[];
  lastTurn: number;
  overtimeFlag: string;
  overtimeLastTurn: number;
  fallbackEnding: string;
  rebelRoute: string[];
  /** round 9: policy_cards.yaml rows, tutorial steps, scenario settings (agenda, courier, autonomy) */
  policyCards: Record<string, unknown>[];
  tutorial: { turn: number; step: number; title: string; text: string; target: string }[];
  settings: Record<string, unknown>;
}

/** Built-in fallback cards (fixture mode only; the dev server serves the real policy_cards.yaml). */
const FALLBACK_CARDS: Record<string, unknown>[] = [
  { id: 'mil_march', category: '军务', title: '出征', summary: '命某军开赴某地，以进攻之态接战。', cost_hint: '不另费钱粮。行程按路线计季。', params: [{ name: 'army', kind: 'army', filter: { idle: true } }, { name: 'to', kind: 'region' }], ops: [{ op: 'march', army: '{army}', to_region: '{to}', with_commander: true }, { op: 'set_army_posture', army: '{army}', posture: 'attack' }] },
  { id: 'mil_hold', category: '军务', title: '坚守本地', summary: '命某军就地固守，不得浪战。', cost_hint: '不费钱粮。守方战力 +20%。', params: [{ name: 'army', kind: 'army' }], ops: [{ op: 'set_army_posture', army: '{army}', posture: 'hold' }] },
  { id: 'int_relief', category: '内政', title: '赈济', summary: '开某道仓廪，赈给贫乏。', cost_hint: '太仓 −50 万石、国库 −10，一季。冷却 2 季。', cooldown: 2, params: [{ name: 'region', kind: 'region', filter: { controller: 'own' } }], ops: [{ op: 'start_project', name: '赈济饥乏', region: '{region}', turns: 1, cost_per_turn: { grain: 50, treasury: 10 }, on_complete: [{ op: 'adjust_region', region: '{region}', stat: 'order', delta: 4 }] }] },
  { id: 'per_recall', category: '人事', title: '召还京师', summary: '诏某人还京。', cost_hint: '不费钱粮。行程按路线计季。', params: [{ name: 'character', kind: 'character', filter: { present: false } }], ops: [{ op: 'move_character', character: '{character}', to_region: 'jingji' }] },
  { id: 'dip_hushi', category: '外交', title: '开边市互市', summary: '于某边道开互市。', cost_hint: '国库每季 −25，两季。冷却 4 季。', cooldown: 4, params: [{ name: 'region', kind: 'region', filter: { ids: ['longyou', 'hexi', 'shuofang'] } }], ops: [{ op: 'start_project', name: '互市', region: '{region}', turns: 2, cost_per_turn: { treasury: 25 } }] },
  { id: 'fin_hedi', category: '财计', title: '和籴实边', summary: '出钱于某边道和籴，充实军储。', cost_hint: '国库 −40，一季。冷却 3 季。', cooldown: 3, params: [{ name: 'region', kind: 'region', filter: { ids: ['hedong', 'longyou', 'hexi', 'shuofang'] } }], ops: [{ op: 'start_project', name: '和籴', region: '{region}', turns: 1, cost_per_turn: { treasury: 40 } }] },
];

const fl = (key: string) => ({ kind: 'flag', key, value: true });
const not = (c: unknown) => ({ not: c });

function fixture(): Db {
  return {
    loaded: 'fixture',
    title: '天宝十载',
    summary: '盛世只剩最后四年。你是唐玄宗，你能阻止安史之乱吗？',
    categories: [
      { id: 'military', name: '军务', hint: '节度、禁军、关防、征伐' },
      { id: 'interior', name: '内政', hint: '任免、财赋、漕运、赈济、吏治' },
      { id: 'diplomacy', name: '外交', hint: '吐蕃、南诏、契丹、大食、回纥' },
      { id: 'other', name: '其他', hint: '宫廷、礼仪、东宫、密旨' },
    ],
    resources: RESOURCES,
    regions: REGIONS.map(({ foreign: _f, jiedushi: _j, ...r }) => (void _f, void _j, r)),
    characters: CHARACTERS,
    armies: ARMIES,
    factions: FACTIONS,
    offices: OFFICES,
    memorials: MEMORIALS,
    events: EVENTS.map((e) => ({
      id: e.id,
      title: e.title,
      text: e.text,
      when: e.turn != null ? { turn: e.turn } : undefined,
      conditions: { all: [...(e.requires ? [fl(e.requires)] : []), ...(e.forbids ? [not(fl(e.forbids))] : [])] },
      gravity: 1,
      effects: e.effects,
      choices: e.choices,
      default_choice: e.default_choice,
      illustration: e.illustration,
    })),
    endings: [
      { ...ENDINGS[6], priority: 1, conditions: { kind: 'region_controller', region: 'jingji', faction: 'yan' } },
      { ...ENDINGS[7], priority: 2, conditions: { kind: 'counter', key: 'bankrupt_streak', operator: 'gte', value: 2 } },
      { ...ENDINGS[3], priority: 3, conditions: { all: [fl('tongguan_lost'), { kind: 'turn', operator: 'gte', value: 23 }] } },
      { ...ENDINGS[2], priority: 4, conditions: { all: [fl('rebellion_started'), { kind: 'turn', operator: 'gte', value: 23 }] } },
      {
        ...ENDINGS[0],
        priority: 5,
        conditions: {
          all: [
            { kind: 'turn', operator: 'gte', value: 20 },
            not(fl('rebellion_started')),
            { kind: 'resource', id: 'rebellion_risk', operator: 'lt', value: 60 },
            { kind: 'resource', id: 'authority', operator: 'gte', value: 50 },
          ],
        },
      },
      { ...ENDINGS[4], priority: 6, conditions: { all: [{ kind: 'resource', id: 'authority', operator: 'lte', value: 25 }, { kind: 'resource', id: 'court_strife', operator: 'gte', value: 80 }] } },
      { ...ENDINGS[1], priority: 7, conditions: { all: [{ kind: 'turn', operator: 'gte', value: 20 }, { kind: 'resource', id: 'fanzhen_power', operator: 'lte', value: 40 }] } },
      { ...ENDINGS[5], priority: 8, conditions: { kind: 'resource', id: 'authority', operator: 'lte', value: 15 } },
    ],
    objectives: OBJECTIVES,
    bands: CRISIS_BANDS,
    crisisTitle: '渔阳鼙鼓',
    terms: [
      { id: 'an', label: '禄山异志', expr: '0.08*(an_ambition-40)' },
      { id: 'fanzhen', label: '外重内轻', expr: '0.05*(fanzhen_power-55)' },
      { id: 'strife', label: '朝堂倾轧', expr: '0.05*(court_strife-45)' },
      { id: 'authority', label: '君威', expr: '-0.04*(authority-60)' },
    ],
    drift: {
      rebellion_risk: '0.08*(an_ambition-40) + 0.05*(fanzhen_power-55) + 0.05*(court_strife-45) - 0.04*(authority-60)',
      an_ambition: '0.03*(fanzhen_power-60) + 0.04*(court_strife-50) - 0.03*(authority-60)',
      authority: '-0.3 - max(0, court_strife-60)*0.03',
      morale: '-max(0, corruption-45)*0.04 - max(0, frontier_pressure-60)*0.03',
    },
    income: [
      { resource: 'treasury', formula: 'tax * 1.5' },
      { resource: 'grain', formula: 'grain * 1.0' },
    ],
    counters: [{ id: 'bankrupt_streak', mode: 'streak', conditions: { all: [{ kind: 'resource', id: 'treasury', operator: 'lte', value: 0 }, { kind: 'resource', id: 'grain', operator: 'lte', value: 200 }] } }],
    ledger: [
      { id: 'l_frontier', name: '边镇军费', category: 'military', amount: -180, kind: 'recurring', reason: '十节度镇兵', resource: 'treasury' },
      { id: 'l_court', name: '宫廷用度', category: 'court', amount: -40, kind: 'recurring', reason: '内廷与宴乐', resource: 'treasury' },
      { id: 'l_rations', name: '军粮', category: 'military', amount: -110, kind: 'recurring', reason: '边镇与禁军口粮', resource: 'grain' },
      { id: 'l_capital', name: '京师廪食', category: 'court', amount: -40, kind: 'recurring', reason: '百官俸禄与京师', resource: 'grain' },
    ],
    lastTurn: 19,
    overtimeFlag: 'rebellion_started',
    overtimeLastTurn: 23,
    fallbackEnding: 'open_storm',
    rebelRoute: ['fanyang', 'hebei', 'duji', 'tongguan', 'jingji'],
    policyCards: FALLBACK_CARDS,
    tutorial: [],
    settings: { agenda: { audience_per_season: 3, debate_per_season: 1 }, capital_region: 'jingji', courier: { late_threshold_days: 45 } },
  };
}

export let db: Db = fixture();

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const str = (v: unknown, d = '') => (v == null ? d : String(v));

let readyPromise: Promise<void> | null = null;
export function dbReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const b = await loadScenarioBundle();
      if (!b?.scenario) return;
      try {
        db = overlay(fixture(), b);
      } catch (err) {
        console.warn('[mock] scenario overlay failed, using fixture', err);
      }
    })();
  }
  return readyPromise;
}

function overlay(base: Db, b: NonNullable<Awaited<ReturnType<typeof loadScenarioBundle>>>): Db {
  const sc = (b.scenario ?? {}) as Obj;
  const out: Db = { ...base, loaded: 'scenario' };
  out.title = str(sc.title, base.title);
  if (arr(sc.edict_categories).length) out.categories = arr(sc.edict_categories).map((c) => ({ id: str(c.id), name: str(c.name), hint: str(c.hint) }));
  if (arr(sc.resources).length) {
    out.resources = arr(sc.resources).map((r) => {
      const prev = base.resources.find((x) => x.id === r.id);
      return {
        id: str(r.id),
        name: str(r.name),
        initial: Number(r.initial ?? 0),
        min: r.min == null ? undefined : Number(r.min),
        max: r.max == null ? undefined : Number(r.max),
        unit: str(r.unit),
        hidden: Boolean(r.hidden),
        estimate_width: r.estimate_width == null ? undefined : Number(r.estimate_width),
        polarity: prev?.polarity ?? 1,
      };
    });
  }
  if (arr(b.regions).length) {
    out.regions = arr(b.regions).map((r) => {
      const adj: Record<string, number> = {};
      for (const a of arr(r.adjacency)) adj[str(a.to)] = Number(a.travel_turns ?? 1);
      if (r.adjacency && !Array.isArray(r.adjacency)) Object.assign(adj, r.adjacency);
      return {
        id: str(r.id),
        name: str(r.name),
        seat: r.seat ? str(r.seat) : undefined,
        controller: str(r.controller, 'tang'),
        stats: (r.stats as Record<string, number>) ?? {},
        adjacency: adj,
        courier_days: r.courier_days == null ? undefined : Number(r.courier_days),
      };
    });
  }
  if (arr(b.characters).length) {
    out.characters = arr(b.characters).map((c) => ({
      id: str(c.id),
      name: str(c.name),
      title: str(c.title),
      faction: str(c.faction, 'tang'),
      office: c.office ? str(c.office) : null,
      offices: Array.isArray(c.offices) ? (c.offices as string[]) : c.office ? [str(c.office)] : [],
      bloc: c.bloc ? str(c.bloc) : null,
      region: str(c.region, 'jingji'),
      traits: (c.traits as Record<string, number>) ?? {},
      persona: str(c.persona),
      speech_style: str(c.speech_style),
      knowledge: Array.isArray(c.knowledge) ? (c.knowledge as string[]) : [],
      status: (str(c.status, 'alive') as Character['status']) ?? 'alive',
    }));
  }
  if (arr(b.armies).length) {
    out.armies = arr(b.armies).map((a) => ({
      id: str(a.id),
      name: str(a.name),
      faction: str(a.faction, 'tang'),
      region: str(a.region),
      strength: Number(a.strength ?? 0),
      commander: a.commander ? str(a.commander) : null,
      loyal_to: a.loyal_to ? str(a.loyal_to) : null,
      quality: Number(a.quality ?? 1),
    }));
  }
  if (arr(b.factions).length) {
    out.factions = arr(b.factions).map((f) => ({ id: str(f.id), name: str(f.name), relations: (f.relations as Record<string, number>) ?? {} }));
  }
  if (arr(sc.offices).length) {
    out.offices = arr(sc.offices).map((o) => {
      const holder = out.characters.find((c) => (c.offices ?? []).includes(str(o.id)));
      return { id: str(o.id), name: str(o.name), holder: holder?.id ?? null };
    });
  }
  if (arr(b.memorials).length) {
    out.memorials = arr(b.memorials).map((m) => ({
      id: str(m.id),
      turn: typeof m.turn === 'number' ? m.turn : undefined,
      conditions: m.conditions,
      expires_after: m.expires_after == null ? undefined : Number(m.expires_after),
      title: str(m.title),
      summary: str(m.summary),
      region: m.region ? str(m.region) : undefined,
      illustration: m.illustration ? str(m.illustration) : undefined,
      advisors: arr(m.advisors).map((a) => ({ character: str(a.character), stance: str(a.stance, 'neutral'), line: str(a.line) })),
      options: arr(m.options).map((o) => ({ id: str(o.id), label: str(o.label), hint: o.hint ? str(o.hint) : undefined, ops: arr(o.ops) as Op[] })),
    }));
  }
  if (arr(b.events).length) {
    out.events = arr(b.events).map((e) => ({
      id: str(e.id),
      title: str(e.title),
      text: str(e.text),
      kind: e.kind ? str(e.kind) : undefined,
      when: (e.when as { turn?: number }) ?? undefined,
      conditions: e.conditions,
      gravity: e.gravity == null ? 1 : Number(e.gravity),
      effects: arr(e.effects) as Op[],
      choices: arr(e.choices).map((c) => ({ id: str(c.id), text: str(c.text), hint: c.hint ? str(c.hint) : undefined, effects: arr(c.effects) as Op[] })),
      default_choice: e.default_choice ? str(e.default_choice) : undefined,
      choice_deadline: e.choice_deadline == null ? undefined : Number(e.choice_deadline),
      repeatable: Boolean(e.repeatable),
      cooldown: e.cooldown == null ? undefined : Number(e.cooldown),
      illustration: e.illustration ? str(e.illustration) : undefined,
    }));
    out.ledger = [];
  }
  if (arr(sc.endings).length) {
    out.endings = arr(sc.endings).map((e) => ({
      id: str(e.id),
      kind: (str(e.kind, 'ending') as 'ending' | 'fail') ?? 'ending',
      title: str(e.title),
      text: str(e.text),
      priority: Number(e.priority ?? 50),
      conditions: e.conditions,
      illustration: e.illustration ? str(e.illustration) : undefined,
    }));
  }
  if (arr(sc.objectives).length) out.objectives = arr(sc.objectives).map((o) => ({ id: str(o.id), title: str(o.title), detail: str(o.detail) }));
  const crisis = (sc.crisis ?? {}) as Obj;
  if (arr(crisis.bands).length) out.bands = arr(crisis.bands).map((x) => ({ max: Number(x.max), name: str(x.name) }));
  if (crisis.title) out.crisisTitle = str(crisis.title);
  if (arr(crisis.terms).length) out.terms = arr(crisis.terms).map((t) => ({ id: str(t.id), label: str(t.label), expr: str(t.expr, '0') }));
  const formulas = (sc.formulas ?? {}) as Obj;
  if (formulas.drift && typeof formulas.drift === 'object') out.drift = formulas.drift as Record<string, string>;
  if (formulas.income && typeof formulas.income === 'object')
    out.income = Object.values(formulas.income as Record<string, Obj>).map((i) => ({ resource: str(i.resource), formula: str(i.formula, '0') }));
  if (arr(sc.counters).length) out.counters = arr(sc.counters).map((c) => ({ id: str(c.id), mode: (str(c.mode, 'streak') as 'streak' | 'count') ?? 'streak', conditions: c.conditions }));
  const gl = (sc.game_length ?? {}) as Obj;
  if (gl.last_turn != null) out.lastTurn = Number(gl.last_turn);
  if (gl.overtime_flag) out.overtimeFlag = str(gl.overtime_flag);
  if (gl.overtime_last_turn != null) out.overtimeLastTurn = Number(gl.overtime_last_turn);
  if (gl.fallback_ending) out.fallbackEnding = str(gl.fallback_ending);
  if (arr(b.policy_cards).length) out.policyCards = arr(b.policy_cards);
  out.tutorial = arr(sc.tutorial).map((t) => ({ turn: Number(t.turn ?? 0), step: Number(t.step ?? 0), title: str(t.title), text: str(t.text), target: str(t.target) }));
  if (sc.settings && typeof sc.settings === 'object') out.settings = sc.settings as Obj;
  const route = arr(sc.ai_routes).find((r) => r.faction === 'yan');
  if (route && Array.isArray(route.route)) out.rebelRoute = route.route as string[];
  return out;
}
