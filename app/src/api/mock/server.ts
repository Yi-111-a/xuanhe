// In-process mock of the engine API (VITE_MOCK=1). Implements docs/CONTRACT.md §2 with a
// small deterministic simulation of the Tianbao scenario so every screen can be developed
// and tested without the Python engine. Answers with real `Response` objects so the typed
// client's parsing (JSON, SSE, `{detail:{code,message}}` errors) is exercised end to end.
import type {
  Advice,
  Army,
  Battle,
  Character,
  Clause,
  DebateSpeech,
  EdictReceipt,
  Fact,
  HistoryEntry,
  LedgerLine,
  MemorialItem,
  Op,
  Outcome,
  PendingChoice,
  Project,
  PublicResource,
  PublicState,
  Region,
  Reply,
  Settings,
  TurnReport,
  UsageRow,
  ViewResponse,
} from '../types';
import { CHAT_LINES, DEBATE_STANCE_TEXT } from './data';
import { db, dbReady } from './db';
import { evalCond, evalExpr } from './scenario';
import { agendaLimits, armies as armiesTable, arrivalText, autonomyProb, cardRow, cardsFor, courierDays, expandCard, isPresent, lateThreshold, opRegion, present, riskLevel, transitText } from './round9';
import { travelTimes } from '../../lib/route';

// ---------------------------------------------------------------- helpers
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(status: number, code: string, message: string): Response {
  return json({ detail: { code, message } }, status);
}

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cnYear(n: number): string {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return `十${CN_NUM[n - 10]}`;
  return `${CN_NUM[Math.floor(n / 10)]}十${n % 10 ? CN_NUM[n % 10] : ''}`;
}
const SEASONS = ['春', '夏', '秋', '冬'];
export function calendarLabel(turn: number): string {
  const year = 10 + Math.floor(turn / 4);
  const era = year >= 15 && turn >= 22 ? `至德${cnYear(year - 14)}载` : `天宝${cnYear(year)}载`;
  return `${era}${SEASONS[turn % 4]}`;
}


// ---------------------------------------------------------------- session model
interface Draft {
  receipt: EdictReceipt;
  adopted: { memorial_id: string; option_id: string }[];
}

interface Entry extends HistoryEntry {
  snapshot: string;
}

interface Session {
  id: string;
  seed: number;
  state: PublicState; // full truth; public view derived on read
  handled: Record<string, string>;
  fired: Record<string, number>;
  advice: Advice[];
  entries: Entry[];
  headId: string | null;
  lastReport: TurnReport | null;
  drafts: Record<string, Draft>;
  updated: string;
  /** test hook: pad every report/memorial/list with lots of content (layout stress) */
  stress?: boolean;
  /** round 9: 朝会日程 counters of the current turn, 回奏 / 书面议状 in the post, tutorial flag */
  agenda?: { turn: number; audience: number; debate: number };
  pendingReplies?: Reply[];
  replies?: Reply[];
  pendingWritten?: Advice[];
  tutorialOff?: boolean;
}

function initialState(): PublicState {
  const resources: Record<string, PublicResource> = {};
  for (const r of db.resources) {
    resources[r.id] = { id: r.id, name: r.name, amount: r.initial, minimum: r.min ?? null, maximum: r.max ?? null, unit: r.unit };
  }
  const regions: Record<string, Region> = {};
  for (const r of db.regions) regions[r.id] = clone(r);
  const characters: Record<string, Character> = {};
  for (const c of db.characters) characters[c.id] = clone(c);
  const armies: Record<string, Army> = {};
  for (const a of db.armies) armies[a.id] = clone(a);
  return {
    scenario_id: 'tianbao_751',
    turn: 0,
    calendar: { year: 751, season: '春', label: calendarLabel(0) },
    resources,
    regions,
    characters,
    offices: Object.fromEntries(db.offices.map((o) => [o.id, clone(o)])),
    factions: Object.fromEntries(db.factions.map((f) => [f.id, clone(f)])),
    armies,
    ledger: clone(db.ledger),
    projects: [],
    standing_orders: [],
    pending_clauses: [],
    flags: {},
    counters: {},
    flag_turns: {},
    pending_choices: [],
    outcome: null,
    rules: { max_concurrent_offices: 3 },
  };
}

// ---------------------------------------------------------------- persistence
const STORE_KEY = 'tianbao.mock.sessions.v1';
let sessions: Record<string, Session> = {};
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) sessions = JSON.parse(raw) as Record<string, Session>;
  } catch {
    sessions = {};
  }
}
function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
  } catch {
    /* storage full or blocked: keep in memory */
  }
}
loadStore();

let settings: Settings = {
  provider: 'mock',
  base_url: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  api_key: '',
  image_provider: 'mock',
  input_cost_per_million: 2,
  output_cost_per_million: 8,
  roles: {
    edict_interpreter: { provider: 'default', model: 'default' },
    narrator: { provider: 'default', model: 'default' },
    character_chat: { provider: 'default', model: 'default' },
    court_debate: { provider: 'default', model: 'default' },
    edict_polish: { provider: 'default', model: 'default' },
    chronicler: { provider: 'default', model: 'default' },
  },
  provider_configs: {},
  presets: {
    mock: { model: 'mock', base_url: '' },
    openai: { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_key_url: 'https://platform.openai.com/api-keys' },
    deepseek: { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', api_key_url: 'https://platform.deepseek.com/api_keys' },
    qwen: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', api_key_url: 'https://dashscope.console.aliyun.com/' },
    glm: { base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', api_key_url: 'https://open.bigmodel.cn/usercenter/apikeys' },
    ollama: { base_url: 'http://localhost:11434/v1', model: 'qwen2.5', api_key_url: '' },
  },
};
const usage: UsageRow[] = [];
function trackUsage(kind: string, turn: number, inTok: number, outTok: number) {
  usage.push({
    id: uid(),
    kind,
    provider: String(settings.provider ?? 'mock'),
    model: String(settings.model ?? 'mock'),
    turn,
    input_tokens: inTok,
    output_tokens: outTok,
    total_tokens: inTok + outTok,
    estimated_cost: (inTok * 2 + outTok * 8) / 1_000_000,
  });
}

// ---------------------------------------------------------------- state ops
function amount(s: PublicState, id: string): number {
  return s.resources[id]?.amount ?? 0;
}

function adjustResource(s: PublicState, id: string, delta: number, facts: Fact[], reason = '') {
  const r = s.resources[id];
  if (!r || !Number.isFinite(delta)) return;
  const before = r.amount ?? 0;
  let after = before + delta;
  if (r.minimum != null) after = Math.max(r.minimum, after);
  if (r.maximum != null) after = Math.min(r.maximum, after);
  r.amount = round1(after);
  if (Math.abs(delta) >= 0.05)
    facts.push({ kind: 'resource', entity: id, before, after: r.amount, text: `${r.name}${delta > 0 ? '增' : '减'}${Math.abs(round1(delta))}${reason ? `（${reason}）` : ''}` });
}

const STAT_NAMES: Record<string, string> = { defense: '防务', order: '治安', prosperity: '繁荣', tax: '税基', grain: '粮产', held: '王化' };

function holderOf(s: PublicState, office: string) {
  return Object.values(s.characters).find((c) => (c.offices ?? []).includes(office) || c.office === office);
}

function applyOp(s: PublicState, op: Op, facts: Fact[]): string | null {
  const name = (id: unknown) => s.characters[String(id)]?.name ?? String(id);
  switch (op.op) {
    case 'adjust_resource':
      adjustResource(s, String(op.resource), Number(op.delta), facts, String(op.reason ?? ''));
      return null;
    case 'set_flag':
      s.flags![String(op.key)] = op.value ?? true;
      s.flag_turns![String(op.key)] = s.turn;
      return null;
    case 'adjust_counter':
      s.counters![String(op.key)] = (s.counters![String(op.key)] ?? 0) + Number(op.delta ?? 1);
      return null;
    case 'set_counter':
      s.counters![String(op.key)] = Number(op.value ?? 0);
      return null;
    case 'start_project': {
      const p: Project & { on_complete?: Op[] } = {
        id: `p_${uid()}`,
        name: String(op.name),
        region: String(op.region ?? 'jingji'),
        turns: Number(op.turns ?? 3),
        progress: 0,
        cost_per_turn: (op.cost_per_turn as Record<string, number>) ?? {},
        on_complete: (op.on_complete as Op[]) ?? [],
      };
      s.projects!.push(p);
      facts.push({ kind: 'project', text: `兴工：${p.name}（${p.turns}季）`, entity: p.id });
      return null;
    }
    case 'adjust_army': {
      const a = s.armies?.[String(op.army)];
      if (!a) return '军队不存在';
      const before = a.strength;
      a.strength = Math.max(0, a.strength + Number(op.delta));
      facts.push({ kind: 'army', entity: a.id, before, after: a.strength, text: `${a.name}兵力${Number(op.delta) > 0 ? '增' : '减'}${Math.abs(Number(op.delta))}${op.reason ? `（${op.reason}）` : ''}` });
      return null;
    }
    case 'move_army': {
      const a = s.armies?.[String(op.army)];
      const to = String(op.to_region ?? op.region ?? '');
      if (!a || !s.regions[to]) return '军队或地区不存在';
      a.region = to;
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}移驻${s.regions[to].name}` });
      return null;
    }
    case 'march': {
      const a = s.armies?.[String(op.army)];
      const to = String(op.to_region ?? '');
      if (!a || !s.regions[to]) return '军队或地区不存在';
      if (a.in_transit) return `${a.name}在途，不能再调`;
      if (to === a.region) return null;
      const eta = travelTimes(s.regions, a.region)[to];
      if (eta == null) return `${a.name}无路可达${s.regions[to].name}`;
      a.in_transit = { from_region: a.region, to_region: to, eta_turn: s.turn + Math.max(1, eta) };
      if (op.with_commander && a.commander && s.characters[a.commander]?.region === a.region) s.characters[a.commander].in_transit = { ...a.in_transit };
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}启程赴${s.regions[to].name}，约${Math.max(1, eta)}季后到` });
      return null;
    }
    case 'detach': {
      const a = s.armies?.[String(op.army)];
      const n = Math.round(Number(op.strength ?? 0));
      if (!a) return '军队不存在';
      if (n <= 0 || n >= a.strength) return `分兵数须少于${a.name}现有兵力（${Math.round(a.strength)}）`;
      a.strength -= n;
      const id = `${a.id}_d${uid().slice(0, 4)}`;
      const to = String(op.to_region ?? a.region);
      const eta = to === a.region ? 0 : travelTimes(s.regions, a.region)[to] ?? 1;
      s.armies![id] = {
        id,
        name: String(op.new_army_name ?? `${a.name}偏师`),
        faction: a.faction,
        region: a.region,
        strength: n,
        commander: op.commander ? String(op.commander) : null,
        quality: a.quality,
        in_transit: eta ? { from_region: a.region, to_region: to, eta_turn: s.turn + Math.max(1, eta) } : null,
      };
      facts.push({ kind: 'army', entity: id, text: `${a.name}分兵${n}，编为「${s.armies![id].name}」${eta ? `赴${s.regions[to]?.name ?? ''}` : '就地分屯'}` });
      return null;
    }
    case 'set_army_posture': {
      const a = s.armies?.[String(op.army)];
      if (!a) return '军队不存在';
      a.posture = String(op.posture ?? 'hold');
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}改取${({ hold: '坚守', attack: '进击', scorch: '坚壁清野' } as Record<string, string>)[a.posture] ?? a.posture}之势` });
      return null;
    }
    case 'set_army_commander': {
      const a = s.armies?.[String(op.army)];
      if (!a) return '军队不存在';
      a.commander = op.character ? String(op.character) : null;
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}${a.commander ? `由${name(a.commander)}统领` : '主帅出缺'}` });
      return null;
    }
    case 'set_army_faction': {
      const a = s.armies?.[String(op.army)];
      if (!a) return '军队不存在';
      a.faction = String(op.faction);
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}改隶${s.factions?.[a.faction]?.name ?? a.faction}` });
      return null;
    }
    case 'set_region_controller': {
      const r = s.regions[String(op.region)];
      if (!r) return '地区不存在';
      r.controller = String(op.faction);
      facts.push({ kind: 'region', entity: r.id, text: `${r.name}归${s.factions?.[r.controller]?.name ?? r.controller}` });
      return null;
    }
    case 'adjust_region': {
      const r = s.regions[String(op.region)];
      if (!r?.stats) return '地区不存在';
      const stat = String(op.stat);
      const max = stat === 'held' ? 1 : 100;
      r.stats[stat] = Math.max(0, Math.min(max, (r.stats[stat] ?? 0) + Number(op.delta)));
      facts.push({ kind: 'region', entity: r.id, text: `${r.name}${STAT_NAMES[stat] ?? stat}${Number(op.delta) > 0 ? '+' : ''}${op.delta}` });
      return null;
    }
    case 'adjust_trait': {
      const c = s.characters[String(op.character)];
      if (!c) return '人物不存在';
      c.traits = { ...(c.traits ?? {}), [String(op.trait)]: (c.traits?.[String(op.trait)] ?? 0) + Number(op.delta ?? 0) };
      return null;
    }
    case 'adjust_relation': {
      const a = s.factions?.[String(op.a)];
      if (!a) return '势力不存在';
      a.relations = { ...(a.relations ?? {}), [String(op.b)]: (a.relations?.[String(op.b)] ?? 0) + Number(op.delta ?? 0) };
      return null;
    }
    case 'add_ledger': {
      const category = String(op.category ?? 'treasury');
      s.ledger!.push({
        id: `l_${uid()}`,
        name: String(op.name),
        category,
        amount: Number(op.amount),
        kind: (op.kind as 'recurring' | 'one_off') ?? 'recurring',
        reason: String(op.reason ?? ''),
        resource: s.resources[category] ? category : 'treasury',
      });
      return null;
    }
    case 'appoint': {
      const c = s.characters[String(op.character)];
      const office = String(op.office);
      if (!c) return '人物不存在';
      if ((c.status ?? 'alive') !== 'alive') return `${c.name}已不在朝`;
      const prev = holderOf(s, office);
      if (prev && prev.id !== c.id) prev.offices = (prev.offices ?? []).filter((x) => x !== office);
      c.offices = Array.from(new Set([...(c.offices ?? []), office]));
      if (!c.office) c.office = office;
      if (s.offices?.[office]) s.offices[office].holder = c.id;
      facts.push({ kind: 'character', entity: c.id, text: `以${c.name}为${s.offices?.[office]?.name ?? office}` });
      return null;
    }
    case 'dismiss': {
      const c = s.characters[String(op.character)];
      if (!c) return '人物不存在';
      const office = op.office ? String(op.office) : c.office ?? '';
      c.offices = (c.offices ?? []).filter((x) => x !== office);
      c.office = c.offices[0] ?? null;
      if (s.offices?.[office]?.holder === c.id) s.offices[office].holder = null;
      facts.push({ kind: 'character', entity: c.id, text: `罢${c.name}${s.offices?.[office]?.name ?? ''}` });
      return null;
    }
    case 'move_character': {
      const c = s.characters[String(op.character)];
      const to = String(op.to_region ?? op.region ?? '');
      if (!c || !s.regions[to]) return '人物或地区不存在';
      c.region = to;
      facts.push({ kind: 'character', entity: c.id, text: `${c.name}赴${s.regions[to].name}` });
      return null;
    }
    case 'set_character_status': {
      const c = s.characters[String(op.character)];
      if (!c) return '人物不存在';
      c.status = op.status as Character['status'];
      if (c.status !== 'alive') {
        for (const o of c.offices ?? []) if (s.offices?.[o]?.holder === c.id) s.offices[o].holder = null;
        c.offices = [];
        c.office = null;
      }
      facts.push({ kind: 'character', entity: c.id, text: `${c.name}${c.status === 'dead' ? '薨' : '去位'}` });
      return null;
    }
    case 'remember': {
      const c = s.characters[String(op.character)];
      if (c) c.memories = [...(c.memories ?? []), String(op.text ?? op.memory ?? '')];
      return null;
    }
    default:
      return null;
  }
}

function bandOf(value: number): string {
  return db.bands.find((b) => value <= b.max)?.name ?? db.bands[db.bands.length - 1]?.name ?? '';
}

const resVar = (s: PublicState) => (n: string) => s.resources[n]?.amount ?? 0;

function crisisTerms(s: PublicState) {
  return db.terms.map((t) => ({ id: t.id, label: t.label, value: round1(evalExpr(t.expr, resVar(s))) }));
}

function estimateFor(s: PublicState, seed: number, id: string): [number, number] {
  const def = db.resources.find((r) => r.id === id)!;
  let half = (def.estimate_width ?? 6) * (1 + amount(s, 'corruption') / 100);
  if (s.flags?.[`intel:${id}`]) half /= 2;
  const noise = ((hash(`${seed}:${s.turn}:${id}`) % 1000) / 1000 - 0.5) * half;
  const centre = amount(s, id) + noise;
  return [Math.max(0, Math.round(centre - half)), Math.min(100, Math.round(centre + half))];
}

function publicView(sess: Session): PublicState {
  const s = clone(sess.state);
  for (const def of db.resources) {
    if (!def.hidden) continue;
    s.resources[def.id] = { id: def.id, name: def.name, hidden: true, estimate: estimateFor(sess.state, sess.seed, def.id), unit: def.unit };
  }
  return s;
}

function visibleMemorials(sess: Session): MemorialItem[] {
  const list = baseMemorials(sess);
  if (!sess.stress) return list;
  // stress: a dozen long memorials (copies carry their own ids)
  const out = [...list];
  for (let i = 0; out.length < 12 && list.length; i++) {
    const m = clone(list[i % list.length]);
    out.push({ ...m, id: `${m.id}__${i}`, title: `${m.title}（续${i + 1}）`, ...(i % 3 === 1 && sess.state.turn > 0 ? { arrived_late: true, origin_turn: sess.state.turn - 1 } : {}) });
  }
  return out;
}

function baseMemorials(sess: Session): MemorialItem[] {
  const s = sess.state;
  return db.memorials
    .filter((m) => !(m.id in sess.handled))
    .filter((m) => (m.turn != null ? m.turn === s.turn : m.conditions ? evalCond(m.conditions, s) : false))
    .slice(0, sess.stress ? 99 : 6)
    .map((m) => {
      const { conditions: _c, expires_after: _e, ...rest } = clone(m);
      void _c;
      void _e;
      if (sess.stress) rest.summary = [rest.summary, rest.summary, rest.summary].join('');
      const region = rest.region ?? 'jingji';
      const days = courierDays(s, region);
      const late = days > lateThreshold() && s.turn > 0;
      return {
        ...rest,
        region_name: s.regions[region]?.name,
        courier_days: days,
        arrival: arrivalText(s, region, late ? -60 : 0),
        arrived_late: late,
        origin_turn: late ? s.turn - 1 : null,
      };
    });
}

function objectives(s: PublicState) {
  const risk = amount(s, 'rebellion_risk');
  const rebelled = Boolean(s.flags?.rebellion_started);
  return db.objectives.map((o) => {
    if (o.id === 'peace') {
      const status = rebelled ? 'fail' : risk >= 60 ? 'fail' : risk >= 40 ? 'warn' : 'ok';
      return { ...o, status, detail: `${o.detail}。当前鼙鼓 ${Math.round(risk)}。` };
    }
    if (o.id === 'supply') {
      const t = amount(s, 'treasury');
      const g = amount(s, 'grain');
      const status = t <= 0 || g <= 500 ? 'fail' : t < 800 || g < 900 ? 'warn' : 'ok';
      return { ...o, status, detail: `${o.detail}。国库 ${Math.round(t)} 万贯，粮储 ${Math.round(g)} 万石。` };
    }
    const a = amount(s, 'authority');
    return { ...o, status: a < 50 ? 'fail' : a < 58 ? 'warn' : 'ok', detail: `${o.detail}。当前君威 ${Math.round(a)}。` };
  });
}

function view(sess: Session): ViewResponse {
  const risk = amount(sess.state, 'rebellion_risk');
  return {
    state: publicView(sess),
    calendar_label: calendarLabel(sess.state.turn),
    objectives: objectives(sess.state),
    crisis: {
      value_or_estimate: round1(risk),
      band: bandOf(risk),
      title: db.crisisTitle,
      bands: db.bands,
      terms: crisisTerms(sess.state),
    },
    memorials: visibleMemorials(sess),
    pending_choices: clone(sess.state.pending_choices ?? []),
    outcome: sess.state.outcome ?? null,
    last_report: sess.lastReport,
    can_advance: !sess.state.outcome,
    command_table: commandTable(sess.state),
    agenda: agendaView(sess),
    replies: (sess.replies ?? []).filter((r) => r.turn === sess.state.turn),
    written_opinions: sess.advice.filter((a) => a.source === '书面议状' && a.turn === sess.state.turn),
    provider_mode: settings.provider === 'mock' ? 'offline' : 'llm',
    tutorial: {
      enabled: !sess.tutorialOff && !sess.state.outcome,
      steps: sess.tutorialOff || sess.state.outcome ? [] : db.tutorial.filter((t) => t.turn === sess.state.turn).sort((a, b) => a.step - b.step),
      total: db.tutorial.length,
    },
    final_notice:
      !sess.state.outcome && sess.state.turn + 1 >= (sess.state.flags?.[db.overtimeFlag] ? db.overtimeLastTurn : db.lastTurn)
        ? { next_is_final: true, last_turn: db.lastTurn, overtime_possible: true, text: '下次结算即终局：本季结算后即到时限，此后不能再下诏、处置事件或推进回合；本季是最后的决策窗口。' }
        : null,
    review: sess.state.outcome
      ? {
          outcome: sess.state.outcome,
          satisfied: ['范阳未反，或反而速平', '君威不低于五十'],
          objectives: objectives(sess.state).map((o) => ({ ...o, status: o.status === 'ok' ? 'achieved' : o.status === 'warn' ? 'at_risk' : 'failed' })),
          stats: db.resources.filter((d) => !d.hidden).map((d) => ({ id: d.id, display: `${d.name} ${Math.round(amount(sess.state, d.id))}${d.unit ?? ''}` })),
          highlights: sess.entries.filter((e) => e.type === 'turn').slice(-8).map((e) => e.label),
          turns_played: sess.state.turn,
        }
      : null,
  };
}

/** 「召对 1/3、廷议 0/1」 (§7.1): counters reset at every settlement. */
function agendaCount(sess: Session) {
  if (!sess.agenda || sess.agenda.turn !== sess.state.turn) sess.agenda = { turn: sess.state.turn, audience: 0, debate: 0 };
  return sess.agenda;
}
function agendaView(sess: Session) {
  const used = agendaCount(sess);
  const lim = sess.stress ? { audience: null, debate: null } : agendaLimits();
  const slot = (label: string, u: number, limit: number | null) => ({ used: u, limit, left: limit == null ? null : Math.max(0, limit - u), label });
  const text = (label: string, u: number, limit: number | null) => `${label} ${limit == null ? '不限' : `${u}/${limit}`}`;
  return {
    audience: slot('召对', used.audience, lim.audience),
    debate: slot('廷议', used.debate, lim.debate),
    remote_reply: 'next_season',
    text: `${text('召对', used.audience, lim.audience)}、${text('廷议', used.debate, lim.debate)}`,
  };
}

/** 官职—所在—所统—指挥状态, derived like the engine's domain/command.py (simplified). */
function commandTable(s: PublicState) {
  const offices = (s.offices ?? {}) as Record<string, { name: string }>;
  const rows = Object.values(s.characters)
    .filter((c) => c.id !== 'xuanzong' && (c.faction ?? 'tang') === 'tang' && (c.status ?? 'alive') === 'alive')
    .map((c) => {
      const commands = Object.values(s.armies ?? {})
        .filter((a) => a.commander === c.id)
        .map((a) => {
          const status = a.region === c.region ? 'present' : 'remote';
          return { army: a.id, name: a.name, strength: a.strength, station: a.region, station_name: s.regions[a.region]?.name, status, label: status === 'present' ? '在营' : `遥领（今在${s.regions[c.region]?.name ?? ''}）` };
        });
      return {
        character: c.id,
        name: c.name,
        offices: (c.offices ?? (c.office ? [c.office] : [])).map((o) => ({ id: o, name: offices[o]?.name ?? o })),
        location: { region: c.region, name: s.regions[c.region]?.name, in_transit: null, display: s.regions[c.region]?.name ?? '' },
        commands,
      };
    })
    .filter((r) => r.offices.length || r.commands.length);
  const leaderless = Object.values(s.armies ?? {}).filter((a) => (a.faction ?? 'tang') === 'tang' && !a.commander && a.strength > 0);
  const alerts = [
    ...rows.flatMap((r) => r.commands.filter((c) => c.status === 'remote').map((c) => `${r.name}遥领${c.name}，不在营中`)),
    ...leaderless.map((a) => `${a.name}无统帅，副将暂摄`),
  ];
  return {
    columns: ['官职', '人物', '所在', '所统', '指挥状态'],
    rows,
    vacancies: { offices: [], armies: leaderless.map((a) => ({ army: a.id, name: a.name, strength: a.strength, station: a.region, station_name: s.regions[a.region]?.name, status: 'acting', label: '无统帅（副将暂摄）' })) },
    alerts,
  };
}

function pushEntry(sess: Session, type: string, label: string) {
  const entry: Entry = {
    id: uid(),
    type,
    turn: sess.state.turn,
    label,
    parentId: sess.headId,
    timestamp: new Date().toISOString(),
    snapshot: JSON.stringify({ state: sess.state, handled: sess.handled, lastReport: sess.lastReport }),
  };
  sess.entries.push(entry);
  sess.headId = entry.id;
  sess.updated = entry.timestamp!;
}

function newSession(seed: number): Session {
  const sess: Session = {
    id: uid() + uid(),
    seed,
    state: initialState(),
    handled: {},
    fired: {},
    advice: [],
    entries: [],
    headId: null,
    lastReport: null,
    drafts: {},
    updated: new Date().toISOString(),
  };
  pushEntry(sess, 'start', `开局·${calendarLabel(0)}`);
  sessions[sess.id] = sess;
  saveStore();
  return sess;
}

// ---------------------------------------------------------------- edict interpretation
interface Rule {
  re: RegExp;
  ops?: Op[];
  reject?: string;
  delay?: string;
}
const r = (resource: string, delta: number, reason: string): Op => ({ op: 'adjust_resource', resource, delta, reason });
const RULES: Rule[] = [
  { re: /诛|斩|赐死|族灭/, reject: '诛戮大臣须经三司推按，诏令不能径行。' },
  { re: /(调|发|遣).{0,8}(兵|军|师)/, ops: [r('fanzhen_power', -2, '调兵入援')], delay: '兵部调发需时，次季方能抵达。' },
  { re: /赈|蠲|减赋|免.{0,4}(租|赋|税)/, ops: [r('morale', 3, '赈济蠲免'), r('grain', -80, '赈济开仓')] },
  { re: /御史|巡察|按察|肃贪|弹劾|吏治/, ops: [r('corruption', -2, '御史出巡')] },
  { re: /禁军|宿卫|彍骑|整训|练兵/, ops: [{ op: 'start_project', name: '禁军整训', region: 'jingji', turns: 4, cost_per_turn: { treasury: 40 } }] },
  { re: /潼关|关防|守关/, ops: [{ op: 'adjust_region', region: 'tongguan', stat: 'defense', delta: 5 }] },
  { re: /(召|宣).{0,6}禄山|禄山.{0,6}入朝/, ops: [{ op: 'set_flag', key: 'an_summoned', value: true }, r('an_ambition', 2, '疑惧')] },
  { re: /漕|汴渠|运河/, ops: [{ op: 'start_project', name: '疏浚汴渠', region: 'henan', turns: 3, cost_per_turn: { treasury: 50 } }] },
  { re: /和籴|籴/, ops: [r('treasury', -80, '和籴'), r('grain', 120, '和籴入仓')] },
  { re: /赏|赐|金帛/, ops: [r('treasury', -50, '赏赐'), r('authority', 1, '恩威并施')] },
  { re: /郭子仪|李光弼/, ops: [{ op: 'set_flag', key: 'shuofang_reliable', value: true }] },
  { re: /约束.{0,4}杨国忠|杨国忠.{0,6}(不得|勿|毋)/, ops: [{ op: 'set_flag', key: 'guozhong_restrained', value: true }, r('court_strife', 2, '杨氏不悦')] },
  { re: /吐蕃|南诏|契丹|大食|回纥|遣使|和亲/, ops: [r('frontier_pressure', -2, '遣使修好')] },
  { re: /东宫|太子/, ops: [r('court_strife', -1, '庇护东宫')] },
];

/** Engine-style one-line summary of an op for receipts (the real engine sends `summary`). */
function opSummary(s: PublicState, op: Op): string {
  const n = (id: unknown) => s.characters[String(id)]?.name ?? s.armies?.[String(id)]?.name ?? s.regions[String(id)]?.name ?? s.offices?.[String(id)]?.name ?? String(id ?? '');
  switch (op.op) {
    case 'march':
      return `${n(op.army)}（全军 ${Math.round(s.armies?.[String(op.army)]?.strength ?? 0)}） 率军赴 ${n(op.to_region)}`;
    case 'set_army_posture':
      return `${n(op.army)} 改取${({ hold: '坚守', attack: '进击', scorch: '坚壁清野' } as Record<string, string>)[String(op.posture)] ?? ''}之势`;
    case 'detach':
      return `${n(op.army)} 分兵 ${op.strength}，赴 ${n(op.to_region)}${op.commander ? `，${n(op.commander)}统领` : ''}`;
    case 'set_army_commander':
      return `以 ${n(op.character)} 统 ${n(op.army)}`;
    case 'start_project':
      return `兴工「${String(op.name ?? '')}」${String(op.turns ?? '?')} 季`;
    case 'appoint':
      return `任 ${n(op.character)} 为 ${n(op.office)}`;
    case 'dismiss':
      return `罢 ${n(op.character)} ${op.office ? n(op.office) : ''}`;
    case 'move_character':
      return `${n(op.character)} 赴 ${n(op.to_region ?? op.region)}`;
    case 'adjust_region':
      return `${n(op.region)}${STAT_NAMES[String(op.stat)] ?? ''} ${Number(op.delta) > 0 ? '+' : ''}${op.delta}`;
    default:
      return '';
  }
}

function interpret(sess: Session, sections: Record<string, string>): Clause[] {
  const clauses: Clause[] = [];
  const offline = settings.provider === 'mock';
  for (const [category, text] of Object.entries(sections)) {
    if (!text?.trim()) continue;
    const sentences = text.split(/[。；;\n]+/).map((x) => x.trim()).filter(Boolean);
    for (const sentence of sentences) {
      if (offline) {
        // §7.4: without a model, the free text is only recorded
        clauses.push({ category, text: sentence, status: 'narrative_only', ops: [], code: 'OFFLINE_TEXT', reason: '未接模型：御笔只记入史册，不生效力；请用奏疏批答或政令卡', source: 'text' });
        continue;
      }
      const rule = RULES.find((rl) => rl.re.test(sentence));
      if (!rule) {
        clauses.push({ category, text: sentence, status: 'narrative_only', ops: [], reason: '此条载于史册，未对应可执行之事。', source: 'text' });
        continue;
      }
      if (rule.reject) {
        clauses.push({ category, text: sentence, status: 'rejected', ops: [], reason: rule.reject, code: 'INVALID_TARGET', source: 'text' });
        continue;
      }
      const sluggish = hash(`${sess.seed}:${sess.state.turn}:${sentence}`) % 100 < amount(sess.state, 'corruption') * 0.25;
      const status = rule.delay ? 'delayed' : sluggish ? 'delayed' : 'applied';
      clauses.push({
        category,
        text: sentence,
        status,
        op: rule.ops?.[0] ?? null,
        ops: rule.ops ?? [],
        reason: status === 'delayed' ? rule.delay ?? '有司推诿，政令迟滞，次季方行。' : '',
        source: 'text',
      });
    }
  }
  return clauses;
}

// ---------------------------------------------------------------- turn resolution
type ChoiceEvent = {
  id: string;
  title: string;
  text: string;
  illustration?: string;
  choices?: { id: string; text: string; hint?: string; effects: Op[] }[];
  default_choice?: string;
  choice_deadline?: number;
};

function openChoice(s: PublicState, ev: ChoiceEvent, turn: number): PendingChoice {
  const pc: PendingChoice = {
    id: `c_${ev.id}_${turn}`,
    event_id: ev.id,
    title: ev.title,
    text: ev.text,
    options: (ev.choices ?? []).map((c) => ({ id: c.id, text: c.text, hint: c.hint, effects: c.effects })),
    default_option: ev.default_choice ?? ev.choices?.[0]?.id,
    created_turn: turn,
    deadline_turn: turn + (ev.choice_deadline ?? 1),
    illustration: ev.illustration,
  };
  s.pending_choices = [...(s.pending_choices ?? []).filter((x) => x.id !== pc.id), pc];
  return pc;
}

function resolveTurn(sess: Session): TurnReport {
  const s = sess.state;
  const facts: Fact[] = [];
  const ledger: LedgerLine[] = [];
  const battles: Battle[] = [];
  const eventsFired: TurnReport['events_fired'] = [];
  const choicesOpened: PendingChoice[] = [];
  const next = s.turn + 1;
  const riskBefore = amount(s, 'rebellion_risk');
  const opening = Object.fromEntries(db.resources.filter((d) => !d.hidden).map((d) => [d.id, amount(s, d.id)]));

  // 1. expired choices → default option
  for (const pc of [...(s.pending_choices ?? [])]) {
    if ((pc.deadline_turn ?? next) <= next) {
      const opt = pc.options.find((o) => o.id === pc.default_option) ?? pc.options[0];
      for (const op of opt?.effects ?? []) applyOp(s, op, facts);
      facts.push({ kind: 'choice', text: `「${pc.title}」逾期未决，依例「${opt?.text ?? ''}」。` });
      s.pending_choices = s.pending_choices!.filter((x) => x.id !== pc.id);
    }
  }
  // 2. delayed clauses
  for (const pcl of [...(s.pending_clauses ?? [])]) {
    if (pcl.due_turn <= next) {
      for (const op of pcl.ops ?? []) applyOp(s, op, facts);
      facts.push({ kind: 'edict', text: '前季迟滞之诏令，本季施行。' });
    }
  }
  s.pending_clauses = (s.pending_clauses ?? []).filter((x) => x.due_turn > next);

  // 4. ledger (recurring)
  for (const l of s.ledger ?? []) {
    const resource = l.resource ?? (s.resources[l.category] ? l.category : 'treasury');
    adjustResource(s, resource, l.amount, [], l.name);
    ledger.push({ name: l.name, amount: l.amount, kind: l.kind, resource, reason: l.reason });
  }
  s.ledger = (s.ledger ?? []).filter((l) => l.kind === 'recurring');

  // 5. income per region
  const tangRegions = Object.values(s.regions).filter((rg) => (rg.controller ?? 'tang') === 'tang' && rg.stats && Object.keys(rg.stats).length);
  for (const inc of db.income) {
    let total = 0;
    for (const rg of tangRegions) total += evalExpr(inc.formula, (n) => (n === 'held' ? rg.stats?.held ?? 1 : rg.stats?.[n] ?? 0));
    total = round1(total);
    const label = inc.resource === 'grain' ? '各道粮赋' : '各道税入';
    adjustResource(s, inc.resource, total, [], label);
    ledger.push({ name: label, amount: total, kind: 'income', resource: inc.resource, reason: inc.resource === 'grain' ? '租粟与江淮漕粮' : '租庸调与户税' });
  }

  // 6. projects
  for (const p of (s.projects ?? []) as (Project & { on_complete?: Op[] })[]) {
    for (const [resId, cost] of Object.entries(p.cost_per_turn ?? {})) {
      adjustResource(s, resId, -cost, [], p.name);
      ledger.push({ name: `工程·${p.name}`, amount: -cost, kind: 'project', resource: resId, reason: `${p.progress + 1}/${p.turns}季` });
    }
    p.progress += 1;
    if (p.progress >= p.turns) {
      facts.push({ kind: 'project', text: `${p.name}告成。` });
      for (const op of p.on_complete ?? []) applyOp(s, op, facts);
      if (!p.on_complete?.length && p.name.includes('禁军')) {
        applyOp(s, { op: 'adjust_region', region: 'jingji', stat: 'defense', delta: 10 }, facts);
        applyOp(s, { op: 'adjust_army', army: 'jinjun', delta: 10000, reason: '整训告成' }, facts);
      }
    }
  }
  s.projects = (s.projects ?? []).filter((p) => p.progress < p.turns);

  // 6b. armies and people on the road arrive
  for (const a of Object.values(s.armies ?? {})) {
    const t = a.in_transit as { to_region?: string; eta_turn?: number } | null | undefined;
    if (t?.to_region && (t.eta_turn ?? next) <= next) {
      a.region = t.to_region;
      a.in_transit = null;
      facts.push({ kind: 'army', entity: a.id, text: `${a.name}抵${s.regions[a.region]?.name ?? ''}` });
    }
  }
  for (const c of Object.values(s.characters)) {
    const t = c.in_transit as { to_region?: string; eta_turn?: number } | null | undefined;
    if (t?.to_region && (t.eta_turn ?? next) <= next) {
      c.region = t.to_region;
      c.in_transit = null;
    }
  }

  // 7–8. rebel march and battles
  for (const army of Object.values(s.armies ?? {}).filter((a) => a.faction === 'yan' && a.strength > 0)) {
    const idx = db.rebelRoute.indexOf(army.region);
    if (idx < 0 || idx >= db.rebelRoute.length - 1) continue;
    const target = db.rebelRoute[idx + 1];
    if (!s.regions[target]) continue;
    const defenders = Object.values(s.armies ?? {}).filter((a) => a.region === target && a.faction === 'tang' && a.strength > 0);
    const defStrength = defenders.reduce((a, d) => a + d.strength * (d.quality ?? 1), 0);
    const defense = s.regions[target]?.stats?.defense ?? 0;
    const atk = army.strength * (army.quality ?? 1) * (0.85 + (hash(`${sess.seed}:${next}:${army.id}`) % 300) / 1000);
    const def = defStrength * (1 + defense / 100);
    const need = defense >= 80 ? 2 : 1;
    if (defenders.length === 0 || atk > def * need) {
      const lossA = Math.round(army.strength * 0.1);
      army.strength -= lossA;
      for (const d of defenders) d.strength = Math.round(d.strength * 0.7);
      army.region = target;
      s.regions[target].controller = 'yan';
      battles.push({ region: target, attacker: army.name, defender: defenders.map((d) => d.name).join('、') || '无守军', winner: army.name, attacker_loss: lossA, defender_loss: Math.round(defStrength * 0.3), text: `${army.name}破${s.regions[target].name}。` });
      s.flags![`${target}_lost`] = true;
    } else {
      const lossA = Math.round(army.strength * 0.3);
      army.strength -= lossA;
      battles.push({ region: target, attacker: army.name, defender: defenders.map((d) => d.name).join('、'), winner: defenders[0].name, attacker_loss: lossA, defender_loss: Math.round(defStrength * 0.1), text: `${s.regions[target].name}守军击退${army.name}。` });
    }
  }

  // 9. drift
  const terms = crisisTerms(s);
  const snapshot = clone(s.resources);
  const v = (n: string) => snapshot[n]?.amount ?? 0;
  for (const [id, expr] of Object.entries(db.drift)) adjustResource(s, id, evalExpr(expr, v), id === 'rebellion_risk' ? facts : [], '时势漂移');

  // 10. events
  s.turn = next;
  for (const ev of db.events) {
    if (ev.when?.turn != null && ev.when.turn !== next) continue;
    const last = sess.fired[ev.id];
    if (last != null && (!ev.repeatable || next - last < (ev.cooldown ?? 1))) continue;
    if (!evalCond(ev.conditions, s)) continue;
    const roll = (hash(`${sess.seed}:${next}:${ev.id}`) % 1000) / 1000;
    if (roll >= (ev.gravity ?? 1)) continue;
    sess.fired[ev.id] = next;
    for (const op of ev.effects) applyOp(s, op, facts);
    if (ev.kind === 'system') continue;
    eventsFired.push({ id: ev.id, title: ev.title, text: ev.text, illustration: ev.illustration });
    if (ev.choices?.length) choicesOpened.push(openChoice(s, ev, next));
  }

  // 11. counters
  for (const c of db.counters) {
    const ok = evalCond(c.conditions, s);
    const cur = s.counters![c.id] ?? 0;
    s.counters![c.id] = ok ? cur + 1 : c.mode === 'streak' ? 0 : cur;
  }

  // 12. endings
  let outcome: Outcome | null = null;
  for (const e of [...db.endings].sort((a, b) => a.priority - b.priority)) {
    if (e.id === db.fallbackEnding) continue;
    if (e.conditions && evalCond(e.conditions, s)) {
      outcome = { kind: e.kind, id: e.id, title: e.title, text: e.text, turn: next };
      break;
    }
  }
  const limit = s.flags?.[db.overtimeFlag] ? db.overtimeLastTurn : db.lastTurn;
  if (!outcome && next > limit) {
    const fb = db.endings.find((e) => e.id === db.fallbackEnding);
    outcome = fb
      ? { kind: fb.kind, id: fb.id, title: fb.title, text: fb.text, turn: next }
      : { kind: 'ending', id: 'open_storm', title: '山雨欲来', text: '鼙鼓未动，而山雨满楼。天下事尚未可知。', turn: next };
  }
  if (outcome) s.outcome = outcome;

  // 13. calendar
  s.calendar = { year: 751 + Math.floor(next / 4), season: SEASONS[next % 4], label: calendarLabel(next) };

  // 回奏 and 书面议状 sent last season arrive with the settlement (§7.1–7.2)
  sess.replies = (sess.pendingReplies ?? []).map((r) => ({ ...r, turn: next }));
  sess.pendingReplies = [];
  for (const w of sess.pendingWritten ?? []) sess.advice.push({ ...w, turn: next });
  sess.pendingWritten = [];

  if (sess.stress) stressReport(sess, facts, ledger, battles, eventsFired);
  const reconciliation = db.resources
    .filter((d) => !d.hidden && d.id in opening)
    .map((d) => {
      const regular = round1(ledger.filter((l) => l.resource === d.id).reduce((a, l) => a + l.amount, 0));
      const closing = round1(amount(s, d.id));
      const events = round1(closing - opening[d.id] - regular);
      return { resource: d.id, name: d.name, unit: d.unit, opening: round1(opening[d.id]), edicts: 0, delayed: 0, regular, events, closing };
    });
  const riskAfter = amount(s, 'rebellion_risk');
  return {
    turn: next,
    facts,
    ledger_lines: ledger,
    events_fired: eventsFired,
    warnings: [],
    state_hash: hash(JSON.stringify(s.resources)).toString(16),
    battles,
    choices_opened: choicesOpened,
    outcome,
    crisis: { before: round1(riskBefore), value: round1(riskAfter), band: bandOf(riskAfter), terms },
    crisis_change: {
      title: db.crisisTitle,
      hidden: false,
      total: round1(riskAfter - riskBefore),
      total_display: fmtSigned(riskAfter - riskBefore),
      items: [
        ...terms.map((t) => ({ kind: 'drift', kind_label: '漂移', label: t.label, value: typeof t.value === 'number' ? t.value : 0, display: fmtSigned(typeof t.value === 'number' ? t.value : 0) })),
        ...eventsFired.slice(0, 3).map((e) => ({ kind: 'event', kind_label: '事件', label: typeof e === 'string' ? e : e.title ?? '', value: 0, display: '±0' })),
      ],
      drift: { base_display: fmtSigned(terms.reduce((a, t) => a + (typeof t.value === 'number' ? t.value : 0), 0)), difficulty_label: '难度', difficulty_display: '×1.0' },
      lines: [],
    },
    reconciliation,
  };
}

/** Layout stress: a season with far more facts, ledger lines, battles and events than any real one. */
function stressReport(sess: Session, facts: Fact[], ledger: LedgerLine[], battles: Battle[], eventsFired: TurnReport['events_fired']) {
  const regions = Object.values(sess.state.regions);
  for (let i = 0; i < 36; i++) {
    const rg = regions[i % regions.length];
    facts.push({ kind: i % 3 ? 'region' : 'army', text: `${rg.name}奏报第${i + 1}事：仓廪、城防、户口诸项有所变动，州县官吏奉诏施行，百姓颇有议论。` });
  }
  facts.push({ kind: 'flag', text: '旗标改变：stress_internal', internal: true });
  for (const res of ['treasury', 'grain', 'authority', 'morale', 'corruption', 'frontier_pressure']) {
    for (let i = 0; i < 5; i++) ledger.push({ name: `杂项支用${i + 1}`, amount: -(i + 1) * 3, kind: 'event', resource: res, reason: '诸司杂支' });
  }
  for (let i = 0; i < 8; i++) {
    const rg = regions[(i * 3) % regions.length];
    battles.push({ region: rg.id, attacker: 'yan', defender: 'tang', winner: i % 2 ? 'tang' : 'yan', attacker_loss: 1200 + i * 100, defender_loss: 900 + i * 50 });
  }
  const evs = db.events.filter((e) => e.kind !== 'system').slice(0, 14);
  for (const ev of evs) eventsFired.push({ id: ev.id, title: ev.title, text: ev.text, illustration: ev.illustration });
}

function fmtSigned(n: number): string {
  const v = round1(n);
  return v === 0 ? '±0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`;
}

function narrate(report: TurnReport, label: string): string {
  const evs = report.events_fired.map((e) => (typeof e === 'string' ? e : e.title)).filter(Boolean);
  const parts = [`${label}。`];
  if (evs.length) parts.push(`是季，${evs.join('；')}。`);
  else parts.push('是季，四方无大事，有司奏报如常。');
  const risk = (report.crisis as { value?: number })?.value ?? 0;
  parts.push(risk >= 60 ? '河北人心惶惶，渔阳之鼓，隐隐可闻。' : risk >= 40 ? '朝野间颇有风闻，言范阳将有异动。' : '长安歌舞升平，万国来朝。');
  return parts.join('');
}

// ---------------------------------------------------------------- debate
const TOPIC_STANCE: { re: RegExp; stance: Record<string, 'support' | 'oppose' | 'neutral'> }[] = [
  { re: /禄山|范阳|削藩|节度|河东|平卢/, stance: { fanyang: 'oppose', yang: 'support', qingliu: 'support', xiang: 'oppose', xibei: 'support', neiting: 'neutral', donggong: 'neutral' } },
  { re: /南诏|吐蕃|征|讨/, stance: { yang: 'support', xibei: 'oppose', qingliu: 'oppose', xiang: 'neutral', fanyang: 'support', neiting: 'neutral', donggong: 'neutral' } },
  { re: /东宫|太子/, stance: { xiang: 'oppose', donggong: 'support', neiting: 'support', qingliu: 'support', yang: 'neutral', fanyang: 'neutral', xibei: 'neutral' } },
];

// ---------------------------------------------------------------- router
type Handler = (m: RegExpMatchArray, body: Record<string, unknown>, signal?: AbortSignal | null) => Promise<Response>;

function getSession(id: string): Session | null {
  return sessions[id] ?? null;
}
const notFound = () => fail(404, 'SESSION_NOT_FOUND', '存档不存在或已删除。');

const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/health$/, async () => json({ ok: true, version: 'mock-0.1.0', scenarios: ['tianbao_751'] })],
  [
    'GET',
    /^\/api\/scenarios$/,
    async () =>
      json([
        {
          id: 'tianbao_751',
          title: db.title,
          era: '盛唐',
          version: '0.1.0',
          valid: true,
          summary: db.summary,
          categories: db.categories,
        },
      ]),
  ],
  [
    'GET',
    /^\/api\/sessions$/,
    async () =>
      json(
        Object.values(sessions)
          .sort((a, b) => b.updated.localeCompare(a.updated))
          .map((x) => ({ id: x.id, scenario: 'tianbao_751', turn: x.state.turn, label: calendarLabel(x.state.turn), updated: x.updated })),
      ),
  ],
  [
    'POST',
    /^\/api\/sessions$/,
    async (_m, body, signal) => {
      await sleep(350, signal);
      if (body.scenario !== 'tianbao_751') return fail(404, 'SCENARIO_NOT_FOUND', '场景不存在。');
      const sess = newSession(Number(body.seed ?? 0) || 0);
      return json({ id: sess.id, scenario: 'tianbao_751', state: publicView(sess) });
    },
  ],
  [
    'DELETE',
    /^\/api\/sessions\/([^/]+)$/,
    async (m) => {
      if (!sessions[m[1]]) return notFound();
      delete sessions[m[1]];
      saveStore();
      return json({ ok: true });
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/view$/,
    async (m, _b, signal) => {
      await sleep(120, signal);
      const sess = getSession(m[1]);
      return sess ? json(view(sess)) : notFound();
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/state$/,
    async (m) => {
      const sess = getSession(m[1]);
      return sess ? json(publicView(sess)) : notFound();
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/edicts\/draft$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      if (sess.state.outcome) return fail(409, 'GAME_OVER', '大局已定，不可再下诏。');
      await sleep(900, signal);
      const sections = (body.sections ?? {}) as Record<string, string>;
      const adopted = (body.adopted ?? []) as { memorial_id: string; option_id: string }[];
      const clientOps = (body.ops ?? []) as Op[];
      const clauses: Clause[] = [];
      for (const a of adopted) {
        const mem = db.memorials.find((x) => x.id === a.memorial_id);
        const opt = mem?.options.find((o) => o.id === a.option_id);
        if (!mem || !opt) {
          clauses.push({ category: 'memorial', text: `${a.memorial_id}/${a.option_id}`, status: 'rejected', reason: '奏疏条目不存在或已处理。', code: 'INVALID_TARGET', source: 'memorial', memorial_id: a.memorial_id, option_id: a.option_id });
          continue;
        }
        clauses.push({ category: 'memorial', text: `${mem.title}：${opt.label}`, status: 'applied', op: opt.ops?.[0] ?? null, ops: opt.ops ?? [], reason: '', source: 'memorial', memorial_id: mem.id, option_id: opt.id });
      }
      // 政令卡 (§7.4): one group per card; far regions wait for the courier (§7.3); army orders
      // carry the commander's autonomy risk (§7.5)
      const s0 = sess.state;
      const far = (op: Op) => {
        const rg = opRegion(s0, op);
        const days = rg ? courierDays(s0, rg) : 0;
        return rg && days > lateThreshold() ? `驿程遥远，令达于下季（${s0.regions[rg]?.name ?? ''}去京城驿程约 ${days} 日）` : '';
      };
      const ORDER: Record<string, string> = { march: 'march', move_army: 'move', detach: 'detach' };
      const riskOf = (op: Op) => {
        if (!op.army) return null;
        const order = op.op === 'set_army_posture' ? String(op.posture ?? 'hold') : ORDER[String(op.op)];
        if (!order) return null;
        const level = riskLevel(autonomyProb(s0, String(op.army), order));
        if (!level) return null;
        const a = s0.armies?.[String(op.army)];
        return { autonomy_risk: level, autonomy_note: `将领自主风险：${level}（${a?.name ?? ''}主将${a?.commander ? s0.characters[a.commander]?.name ?? '' : ''}）` };
      };
      const cards = (body.cards ?? []) as { card_id: string; params: Record<string, unknown> }[];
      const usedCooldown = new Set<string>();
      let group = clauses.length + 1;
      for (const c of cards) {
        const row = cardRow(c.card_id);
        const info = cardsFor(s0).find((x) => x.id === c.card_id);
        const base = { category: String(row?.category ?? '政令'), source: 'card', card_id: c.card_id, card_title: info?.title, cost_hint: info?.cost_hint, label: `政令卡「${info?.title ?? c.card_id}」`, group: group++ } as const;
        if (!row || !info) {
          clauses.push({ ...base, text: c.card_id, status: 'rejected', code: 'UNKNOWN_CARD', reason: '无此政令卡。' });
          continue;
        }
        const missing = info.params.filter((p) => c.params?.[p.name] === undefined || c.params?.[p.name] === '');
        const bad = info.params.find((p) => p.options && c.params?.[p.name] !== undefined && !p.options.some((o) => o.id === c.params[p.name]));
        const textOf = info.params.map((p) => `${p.label ?? p.name}：${p.options?.find((o) => o.id === c.params?.[p.name])?.name ?? c.params?.[p.name] ?? '—'}`).join('，');
        const text = `${info.title}${textOf ? `：${textOf}` : ''}`;
        if (!info.available) {
          clauses.push({ ...base, text, status: 'rejected', code: 'CARD_UNAVAILABLE', reason: info.unavailable_reason || '此卡暂不可用。' });
          continue;
        }
        if (missing.length) {
          clauses.push({ ...base, text, status: 'rejected', code: 'CARD_PARAM_MISSING', reason: `缺少参数：${missing.map((p) => p.label ?? p.name).join('、')}` });
          continue;
        }
        if (bad) {
          clauses.push({ ...base, text, status: 'rejected', code: 'INVALID_CARD_PARAM', reason: `「${bad.label ?? bad.name}」可选：${(bad.options ?? []).slice(0, 8).map((o) => o.name).join('、')}` });
          continue;
        }
        if (info.cooldown && usedCooldown.has(info.id)) {
          clauses.push({ ...base, text, status: 'rejected', code: 'CARD_COOLDOWN', reason: '有冷却的政令卡，一道诏书只能用一次。' });
          continue;
        }
        usedCooldown.add(info.id);
        const ops = expandCard(s0, row, c.params);
        const courier = ops.map(far).find(Boolean) ?? '';
        for (const op of ops) {
          clauses.push({
            ...base,
            text,
            op,
            ops: [op],
            summary: opSummary(s0, op),
            ...(courier ? { status: 'delayed', delay_kind: 'courier', delay_reason: courier, due_turn: s0.turn + 1 } : { status: 'applied', reason: '' }),
            ...(riskOf(op) ?? {}),
          });
        }
      }
      clauses.push(...interpret(sess, sections));
      for (const op of clientOps) {
        const courier = far(op);
        clauses.push({
          category: 'client',
          text: String(op.reason ?? opSummary(s0, op) ?? op.op ?? '军令'),
          op,
          ops: [op],
          source: 'client',
          group: group++,
          summary: opSummary(s0, op),
          ...(courier ? { status: 'delayed', delay_kind: 'courier', delay_reason: courier, due_turn: s0.turn + 1 } : { status: 'applied' }),
          ...(riskOf(op) ?? {}),
        });
      }
      if (clauses.length === 0) return fail(422, 'EMPTY_EDICT', '诏书尚无一字，无从颁行。');
      const receipt: EdictReceipt = {
        id: `edict-${uid()}`,
        clauses,
        execution_rate: clauses.filter((c) => c.status === 'applied').length / clauses.length,
        confirmed: false,
      };
      sess.drafts[receipt.id] = { receipt, adopted };
      trackUsage('edict_interpreter', sess.state.turn, 1800, 420);
      saveStore();
      return json(receipt);
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/edicts\/polish$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      await sleep(700, signal);
      const sections = (body.sections ?? {}) as Record<string, string>;
      const text = Object.values(sections).filter((x) => x?.trim()).join('；');
      if (!text) return fail(422, 'EMPTY_EDICT', '诏书尚无一字，无可润色。');
      trackUsage('edict_polish', sess.state.turn, 600, 200);
      return json({ text: `门下：朕闻安不忘危，治不忘乱。${text.replace(/[。；]*$/, '')}。主者施行。` });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/edicts\/([^/]+)\/confirm$/,
    async (m, _b, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const draft = sess.drafts[m[2]];
      if (!draft) return fail(404, 'EDICT_NOT_FOUND', '诏令草案不存在或已过期。');
      if (draft.receipt.confirmed) return fail(409, 'EDICT_CONFIRMED', '诏令已经颁行。');
      await sleep(500, signal);
      const facts: Fact[] = [];
      for (const clause of draft.receipt.clauses) {
        const ops = clause.ops?.length ? clause.ops : clause.op ? [clause.op] : [];
        if (clause.status === 'applied') {
          for (const op of ops) {
            const err = applyOp(sess.state, op, facts);
            if (err) {
              clause.status = 'rejected';
              clause.reason = err;
            }
          }
        } else if (clause.status === 'delayed' && ops.length) {
          sess.state.pending_clauses!.push({ id: uid(), due_turn: sess.state.turn + 1, source: 'edict', ops });
        }
      }
      for (const c of draft.receipt.clauses) if (c.source === 'card' && c.card_id && c.status !== 'rejected') sess.state.flags![`card:${c.card_id}`] = sess.state.turn;
      for (const a of draft.adopted) {
        sess.handled[a.memorial_id] = a.option_id;
        sess.state.flags![`memorial:${a.memorial_id}`] = a.option_id;
      }
      draft.receipt.confirmed = true;
      draft.receipt.state = publicView(sess);
      const first = draft.receipt.clauses[0]?.text ?? '诏令';
      pushEntry(sess, 'edict', `颁诏：${first.length > 14 ? `${first.slice(0, 14)}…` : first}`);
      saveStore();
      return json(draft.receipt);
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/abort$/,
    async (m) => (getSession(m[1]) ? json({ aborted: true }) : notFound()),
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/choices\/([^/]+)$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const pc = sess.state.pending_choices?.find((c) => c.id === m[2]);
      if (!pc) return fail(404, 'CHOICE_NOT_FOUND', '此事已决或已逾期。');
      const opt = pc.options.find((o) => o.id === body.option_id);
      if (!opt) return fail(422, 'OPTION_NOT_FOUND', '无此选项。');
      await sleep(300, signal);
      const facts: Fact[] = [];
      for (const op of opt.effects ?? []) applyOp(sess.state, op, facts);
      sess.state.pending_choices = sess.state.pending_choices!.filter((c) => c.id !== pc.id);
      pushEntry(sess, 'choice', `抉择：${pc.title}·${opt.text}`);
      saveStore();
      return json({ ok: true, facts, state: publicView(sess) });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/turn$/,
    async (m, _b, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      if (sess.state.outcome) return fail(409, 'GAME_OVER', '大局已定，史册已合。');
      await sleep(1400, signal);
      const report = resolveTurn(sess);
      sess.lastReport = report;
      const memorial = narrate(report, calendarLabel(sess.state.turn));
      trackUsage('narrator', sess.state.turn, 1200, 300);
      pushEntry(sess, 'turn', `推演：${calendarLabel(sess.state.turn)}`);
      saveStore();
      return json({ state: publicView(sess), report, memorial, outcome: sess.state.outcome ?? null, replies: sess.replies ?? [], written_opinions: sess.advice.filter((a) => a.source === '书面议状' && a.turn === sess.state.turn) });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/debate$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const topic = String(body.topic ?? '').trim();
      const participants = (body.participants ?? []) as string[];
      const written = (body.written ?? []) as string[];
      if (!topic) return fail(422, 'EMPTY_TOPIC', '廷议须有议题。');
      if (participants.length + written.length < 1 || participants.length > 6 || written.length > 6) return fail(422, 'INVALID_REQUEST', '廷议至少一人；当场与议、书面议状各至多六人。');
      const ag = agendaCount(sess);
      const dLimit = sess.stress ? null : agendaLimits().debate;
      if (dLimit != null && ag.debate >= dLimit) return fail(409, 'AGENDA_EXHAUSTED', `本季廷议已满（已用 ${ag.debate}/${dLimit}，剩余 0 次）；下季结算后重置。`);
      for (const id of [...participants, ...written]) {
        const c = sess.state.characters[id];
        if (!c) return fail(404, 'CHARACTER_NOT_FOUND', '无此人。');
        if (c.status && c.status !== 'alive') return fail(409, 'CHARACTER_UNAVAILABLE', `${c.name}已不在朝。`);
      }
      for (const id of participants) {
        const c = sess.state.characters[id];
        if (!isPresent(sess.state, id)) return fail(409, 'NOT_PRESENT', `${c.name}不在京畿（在${sess.state.regions[c.region]?.name ?? '外'}），不能当场廷议；可列入 written 递书面议状，其议于下季送达`);
      }
      for (const id of written) if (isPresent(sess.state, id)) return fail(422, 'INVALID_REQUEST', `${sess.state.characters[id].name}在京，应列入当场与议之人。`);
      await sleep(1100, signal);
      ag.debate += 1;
      const rule = TOPIC_STANCE.find((t) => t.re.test(topic));
      const speeches: DebateSpeech[] = [];
      const stanceOf = (id: string) => {
        const bloc = sess.state.characters[id].bloc ?? 'neiting';
        return rule?.stance[bloc] ?? (['support', 'oppose', 'neutral'] as const)[hash(topic + id) % 3];
      };
      for (const id of participants) {
        const c = sess.state.characters[id];
        const stance = stanceOf(id);
        const lines = DEBATE_STANCE_TEXT[c.bloc ?? 'neiting'] ?? DEBATE_STANCE_TEXT.neiting;
        speeches.push({
          character: id,
          stance,
          text: `「${topic}」一事——${lines[stance as 'support']}`,
          target_option_id: null,
          position: `${stance === 'support' ? '赞成' : stance === 'oppose' ? '反对' : '持中'}「${topic}」`,
          proposition: topic,
        });
      }
      const [a, b] = participants;
      for (const id of written) {
        const c = sess.state.characters[id];
        const st = stanceOf(id);
        (sess.pendingWritten ??= []).push({ id: uid(), character: id, name: c.name, source: '书面议状', text: `〔书面议状·自${sess.state.regions[c.region]?.name ?? '外'}驿递〕就「${topic}」${st === 'support' ? '赞成' : st === 'oppose' ? '反对' : '持中'}：${(DEBATE_STANCE_TEXT[c.bloc ?? 'neiting'] ?? DEBATE_STANCE_TEXT.neiting)[st as 'support']}` });
      }
      saveStore();
      if (a && b && stanceOf(a) !== stanceOf(b)) {
        speeches.push({ character: a, stance: stanceOf(a), text: `${sess.state.characters[b].name}所言差矣。${DEBATE_STANCE_TEXT[sess.state.characters[a].bloc ?? 'neiting']?.[stanceOf(a) as 'support'] ?? ''}` });
        speeches.push({ character: b, stance: stanceOf(b), text: `臣不敢苟同。${DEBATE_STANCE_TEXT[sess.state.characters[b].bloc ?? 'neiting']?.[stanceOf(b) as 'support'] ?? ''}` });
      }
      const pro = participants.filter((id) => stanceOf(id) === 'support').map((id) => sess.state.characters[id].name);
      const con = participants.filter((id) => stanceOf(id) === 'oppose').map((id) => sess.state.characters[id].name);
      trackUsage('court_debate', sess.state.turn, 2200, 640);
      return json({
        topic,
        proposition: topic,
        memorial: null,
        speeches,
        written: written.map((id) => ({ character: id, name: sess.state.characters[id].name, whereabouts: sess.state.regions[sess.state.characters[id].region]?.name ?? '', note: '书面议状已发，其议于下季送达（入谏言库）' })),
        summary: participants.length
          ? `${pro.length ? `${pro.join('、')}以为可行` : '无人力主其事'}；${con.length ? `${con.join('、')}以为不可` : '无人力阻'}。议定与否，伏候圣裁。`
          : '在京无人与议；书面议状已发，下季送达。',
      });
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/advice$/,
    async (m) => {
      const sess = getSession(m[1]);
      return sess ? json(sess.advice) : notFound();
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/advice$/,
    async (m, body) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const text = String(body.text ?? '').trim();
      if (!text) return fail(422, 'EMPTY_ADVICE', '谏言不可为空。');
      const adv: Advice = { id: uid(), character: String(body.character ?? ''), text, source: String(body.source ?? 'audience'), turn: sess.state.turn };
      sess.advice.push(adv);
      saveStore();
      return json(adv);
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/history$/,
    async (m) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      return json(sess.entries.map(({ snapshot: _s, ...e }) => ({ ...e, head: e.id === sess.headId })));
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/export$/,
    async (m) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      return json({ session_id: sess.id, scenario: 'tianbao_751', seed: sess.seed, turn: sess.state.turn, calendar_label: calendarLabel(sess.state.turn), outcome: sess.state.outcome ?? null, seasons: sess.entries.map(({ snapshot: _s, ...e }) => e) });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/rewind$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const entry = sess.entries.find((e) => e.id === body.entry_id);
      if (!entry) return fail(404, 'ENTRY_NOT_FOUND', '史册中无此一页。');
      await sleep(400, signal);
      const snap = JSON.parse(entry.snapshot) as { state: PublicState; handled: Record<string, string>; lastReport: TurnReport | null };
      sess.state = snap.state;
      sess.handled = snap.handled;
      sess.lastReport = snap.lastReport;
      sess.headId = entry.id;
      sess.updated = new Date().toISOString();
      saveStore();
      return json({ ok: true, head: entry.id, state: publicView(sess) });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/chat\/([^/]+)$/,
    async (m, body, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const c = sess.state.characters[m[2]];
      if (!c) return fail(404, 'CHARACTER_NOT_FOUND', '无此人。');
      const userText = String(body.text ?? '');
      let status = 'ok';
      let content: string;
      const ag = agendaCount(sess);
      const aLimit = sess.stress ? null : agendaLimits().audience;
      const alive = !c.status || c.status === 'alive';
      if (alive && aLimit != null && ag.audience >= aLimit) return fail(409, 'AGENDA_EXHAUSTED', `本季召对已满（已用 ${ag.audience}/${aLimit}，剩余 0 次）；下季结算后重置。`);
      const transit = transitText(sess.state, c.region, c.in_transit as Record<string, unknown> | null);
      const where = sess.state.regions[c.region]?.name ?? '外镇';
      if (!alive) {
        status = 'refused';
        content = `${c.name}已不在人世，无从召对。`;
      } else if (!isPresent(sess.state, c.id)) {
        // §7.1: away from the capital → the envoy leaves now, the answer comes with the next settlement
        ag.audience += 1;
        const mode = transit ? { mode: 'envoy', mode_label: '遣使问对', mode_note: `${c.name}${transit}：遣使于途中问对。` } : { mode: 'written', mode_label: '书面奏对', mode_note: `${c.name}人在${where}，不在御前：以书面奏对，驿递往还。` };
        (sess.pendingReplies ??= []).push({
          character: c.id,
          name: c.name,
          mode: mode.mode,
          mode_label: mode.mode_label,
          question: userText,
          asked_turn: sess.state.turn,
          turn: sess.state.turn + 1,
          text: `〔${mode.mode_label}·自${where}驿递〕${(CHAT_LINES[c.id] ?? ['臣谨奏：边事如常，伏惟圣鉴。'])[hash(userText) % (CHAT_LINES[c.id]?.length ?? 1)]}`,
          roleplay: false,
          via: 'rest',
        });
        saveStore();
        const text = `使者已发，回奏于下季送达（${mode.mode_label}：${mode.mode_note}）`;
        const agenda = agendaView(sess);
        const enc = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            send('status', { status: 'ok', ...mode });
            send('deferred', { text, agenda });
            send('message', { text });
            send('done', {});
            controller.close();
          },
        });
        await sleep(250, signal);
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
      } else {
        ag.audience += 1;
        saveStore();
        const lines = CHAT_LINES[c.id] ?? ['臣谨遵圣谕。'];
        const pickLine = lines[hash(userText + sess.state.turn) % lines.length];
        content = userText.includes('禄山') && c.id !== 'an_lushan' && lines.length > 1 ? lines[0] : pickLine;
      }
      await sleep(350, signal);
      trackUsage('character_chat', sess.state.turn, 1500, Math.round(content.length * 1.4));
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: string, data: unknown) =>
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          const mode = { mode: 'in_person', mode_label: '面见', mode_note: '' };
          send('status', status === 'refused' ? { status } : { status: 'ok', ...mode });
          for (let i = 0; i < content.length; i += 4) {
            if (signal?.aborted) break;
            await new Promise((res) => setTimeout(res, 38));
            send('message', { text: content.slice(i, i + 4) });
          }
          send('done', {});
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/present$/,
    async (m) => {
      const sess = getSession(m[1]);
      return sess ? json(present(sess.state)) : notFound();
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/policy_cards$/,
    async (m, _b, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      await sleep(80, signal);
      return json(cardsFor(sess.state));
    },
  ],
  [
    'GET',
    /^\/api\/sessions\/([^/]+)\/armies$/,
    async (m, _b, signal) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      await sleep(80, signal);
      return json(armiesTable(sess.state));
    },
  ],
  [
    'PUT',
    /^\/api\/sessions\/([^/]+)\/flags$/,
    async (m, body) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      if (typeof body.tutorial === 'boolean') sess.tutorialOff = !body.tutorial;
      saveStore();
      return json({ session_flags: { tutorial: !sess.tutorialOff }, tutorial: !sess.tutorialOff });
    },
  ],
  [
    'POST',
    /^\/api\/sessions\/([^/]+)\/fork$/,
    async (m) => {
      const sess = getSession(m[1]);
      if (!sess) return notFound();
      const copy = clone(sess);
      copy.id = uid() + uid();
      sessions[copy.id] = copy;
      saveStore();
      return json({ id: copy.id, state: publicView(copy) });
    },
  ],
  [
    'GET',
    /^\/api\/usage$/,
    async () =>
      json({
        calls: usage,
        total_tokens: usage.reduce((a, u) => a + u.total_tokens, 0),
        estimated_cost: usage.reduce((a, u) => a + u.estimated_cost, 0),
        cost_rates_configured: true,
      }),
  ],
  ['GET', /^\/api\/settings$/, async () => json(maskSettings(settings))],
  [
    'PUT',
    /^\/api\/settings$/,
    async (_m, body, signal) => {
      await sleep(250, signal);
      settings = { ...settings, ...body };
      return json(maskSettings(settings));
    },
  ],
  [
    'POST',
    /^\/api\/settings\/test$/,
    async (_m, _b, signal) => {
      await sleep(600, signal);
      if (settings.provider !== 'mock' && !settings.api_key) return fail(502, 'PROVIDER_UNREACHABLE', '模型连接失败：尚未填写密钥。');
      return json({ ok: true, tool_calling: true, json_fallback: false, model: settings.model });
    },
  ],
];

function maskSettings(s: Settings): Settings {
  const out = clone(s);
  const mask = (v: unknown) => {
    const t = String(v ?? '');
    return t.length > 6 ? `${t.slice(0, 3)}…${t.slice(-2)}` : t ? '已设置' : '';
  };
  out.api_key = mask(out.api_key);
  for (const cfg of Object.values(out.provider_configs ?? {})) if (cfg.api_key) cfg.api_key = mask(cfg.api_key);
  return out;
}

export async function mockFetch(input: string, init?: RequestInit): Promise<Response> {
  await dbReady();
  const url = new URL(input, 'http://mock.local');
  const method = (init?.method ?? 'GET').toUpperCase();
  let body: Record<string, unknown> = {};
  if (typeof init?.body === 'string' && init.body) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return fail(400, 'BAD_JSON', '请求体不是合法的 JSON。');
    }
  }
  const path = decodeURIComponent(url.pathname);
  for (const [m, re, handler] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (match) return handler(match, body, init?.signal);
  }
  return fail(404, 'NOT_FOUND', `无此接口：${method} ${path}`);
}

// ---------------------------------------------------------------- dev hooks (tests)
declare global {
  interface Window {
    __tianbaoMock?: {
      forceOutcome: (sessionId: string, endingId: string) => void;
      openChoice: (sessionId: string) => void;
      reset: () => void;
      stress: (sessionId: string, on?: boolean) => void;
    };
  }
}
if (typeof window !== 'undefined') {
  window.__tianbaoMock = {
    forceOutcome(sessionId, endingId) {
      const sess = sessions[sessionId];
      const e = db.endings.find((x) => x.id === endingId) ?? db.endings.find((x) => x.kind === 'ending') ?? db.endings[0];
      if (!sess) return;
      sess.state.outcome = { kind: e.kind, id: e.id, title: e.title, text: e.text, turn: sess.state.turn };
      saveStore();
    },
    openChoice(sessionId) {
      const sess = sessions[sessionId];
      const ev = db.events.find((x) => x.id === 'khitan_defeat' && x.choices?.length) ?? db.events.find((x) => x.choices?.length);
      if (!sess || !ev) return;
      openChoice(sess.state, ev, sess.state.turn);
      saveStore();
    },
    reset() {
      sessions = {};
      saveStore();
    },
    stress(sessionId, on = true) {
      const sess = sessions[sessionId];
      if (!sess) return;
      sess.stress = on;
      if (on) {
        const chars = Object.keys(sess.state.characters).slice(0, 10);
        for (let i = 0; i < 30; i++)
          sess.advice.push({ id: uid(), character: chars[i % chars.length], text: `第${i + 1}条谏言：陛下宜慎择将帅，节用爱人，勿使边镇坐大，以固根本。`, source: 'audience', turn: sess.state.turn });
        for (let i = 0; i < 40; i++)
          sess.entries.push({ id: uid(), type: i % 2 ? 'turn' : 'edict', turn: sess.state.turn, label: `史册第${i + 1}页·奏议施行`, parentId: sess.headId, timestamp: new Date().toISOString(), snapshot: sess.entries[0].snapshot });
      }
      saveStore();
    },
  };
}
