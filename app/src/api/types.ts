// Types for the 《天宝》 REST API — docs/CONTRACT.md §1–§2.
// Fields the contract leaves open are typed as optional so the UI degrades gracefully
// while the engine is still being built.

export type ID = string;

export interface Calendar {
  year: number;
  month?: number;
  season?: string;
  label?: string;
}

export interface PublicResource {
  id: ID;
  name: string;
  amount?: number;
  minimum?: number | null;
  maximum?: number | null;
  unit?: string;
  hidden?: boolean;
  /** Only for hidden resources in public_view: [lo, hi]. */
  estimate?: [number, number];
}

export interface Region {
  id: ID;
  name: string;
  x?: number;
  y?: number;
  polygon?: number[][];
  adjacency?: Record<ID, number>;
  stats?: Record<string, number>;
  controller?: ID | null;
  seat?: string;
  courier_days?: number;
}

export type CharacterStatus = 'alive' | 'dead' | 'imprisoned' | 'exiled' | 'retired';

export interface Character {
  id: ID;
  name: string;
  faction?: ID | null;
  office?: ID | null;
  offices?: ID[];
  bloc?: string | null;
  title?: string;
  region: ID;
  traits?: Record<string, number>;
  persona?: string;
  speech_style?: string;
  knowledge?: string[];
  status?: CharacterStatus;
  in_transit?: Record<string, unknown> | null;
  memories?: string[];
}

export interface Office {
  id: ID;
  name: string;
  holder?: ID | null;
  requires?: Record<string, unknown>;
}

export interface Faction {
  id: ID;
  name: string;
  relations?: Record<ID, number>;
}

export interface Army {
  id: ID;
  name: string;
  faction?: ID | null;
  region: ID;
  strength: number;
  commander?: ID | null;
  loyal_to?: ID | null;
  quality?: number;
  in_transit?: Record<string, unknown> | null;
  posture?: string | null;
}

export interface LedgerEntry {
  id: ID;
  name: string;
  category: string;
  amount: number;
  kind: 'one_off' | 'recurring';
  turns?: number | null;
  reason?: string;
  resource?: ID;
}

export interface Project {
  id: ID;
  name: string;
  region: ID;
  cost_per_turn?: Record<string, number>;
  turns: number;
  progress: number;
  stalled?: boolean;
}

export interface StandingOrder {
  id: ID;
  text: string;
  until_turn?: number | null;
}

export interface ChoiceOption {
  id: ID;
  text: string;
  effects?: Op[];
  conditions?: unknown;
  hint?: string;
}

export interface PendingChoice {
  id: ID;
  event_id: ID;
  title: string;
  text: string;
  options: ChoiceOption[];
  default_option?: ID;
  created_turn?: number;
  deadline_turn?: number;
  illustration?: string;
}

export interface Outcome {
  kind: 'ending' | 'fail';
  id: ID;
  title: string;
  text: string;
  turn: number;
}

export interface PublicState {
  scenario_id: ID;
  turn: number;
  calendar: Calendar;
  resources: Record<ID, PublicResource>;
  regions: Record<ID, Region>;
  characters: Record<ID, Character>;
  offices?: Record<ID, Office>;
  factions?: Record<ID, Faction>;
  armies?: Record<ID, Army>;
  ledger?: LedgerEntry[];
  projects?: Project[];
  standing_orders?: StandingOrder[];
  pending_clauses?: { id: ID; due_turn: number; source?: string; ops?: Op[] }[];
  flags?: Record<string, unknown>;
  counters?: Record<string, number>;
  flag_turns?: Record<string, number>;
  pending_choices?: PendingChoice[];
  outcome?: Outcome | null;
  rules?: Record<string, unknown>;
}

export type Op = Record<string, unknown> & { op?: string };

export interface Objective {
  id: ID;
  title: string;
  status: 'ok' | 'warn' | 'fail' | 'done' | 'pending' | string;
  detail?: string;
}

export interface CrisisTerm {
  id?: ID;
  label: string;
  /** a number, or [lo, hi] when the term depends on a hidden value */
  value: number | [number, number];
  estimated?: boolean;
  display?: string;
}

export interface CrisisView {
  value_or_estimate: number | [number, number];
  display?: string;
  band: string;
  title?: string;
  terms: CrisisTerm[];
  bands?: { max: number; name: string }[];
}

export type Stance = 'support' | 'oppose' | 'neutral' | string;

export interface MemorialAdvisor {
  character: ID;
  stance: Stance;
  line: string;
}

export interface MemorialOption {
  id: ID;
  label: string;
  ops?: Op[];
  hint?: string;
}

export interface MemorialItem {
  id: ID;
  turn?: number;
  title: string;
  summary: string;
  region?: ID;
  region_name?: string;
  advisors: MemorialAdvisor[];
  options: MemorialOption[];
  illustration?: string;
  /** round 9 (§7.3): courier days from the region, 「正月初五日自河东奏到」, late arrivals */
  courier_days?: number;
  arrival?: string | null;
  arrived_late?: boolean;
  origin_turn?: number | null;
}

export interface Fact {
  kind: string;
  text: string;
  entity?: string | null;
  before?: unknown;
  after?: unknown;
  display?: string;
  internal?: boolean;
}

export interface LedgerLine {
  name: string;
  amount: number;
  kind: string;
  resource: ID;
  reason?: string;
  display?: string;
}

export interface Battle {
  region?: ID;
  attacker?: ID | string;
  defender?: ID | string;
  winner?: ID | string;
  attacker_loss?: number;
  defender_loss?: number;
  result?: string;
  text?: string;
  winner_name?: string;
  captured?: boolean;
}

export interface CrisisReport {
  value?: number;
  value_or_estimate?: number | [number, number];
  display?: string;
  before?: number;
  band?: string;
  terms?: CrisisTerm[];
}

export interface TurnReport {
  turn: number;
  facts: Fact[];
  ledger_lines: LedgerLine[];
  events_fired: (ID | { id: ID; title?: string; text?: string; illustration?: string })[];
  warnings?: string[];
  state_hash?: string;
  battles?: Battle[];
  choices_opened?: (ID | PendingChoice)[];
  outcome?: Outcome | null;
  crisis?: CrisisReport | Record<string, unknown>;
  resource_deltas?: Record<ID, number>;
  /** player-facing events of the season, most important first (engine ≥ round 3) */
  events?: ReportEvent[];
  featured_event?: ReportEvent | null;
  reconciliation?: ReconciliationRow[];
  crisis_change?: CrisisChange | null;
}

export interface ReportEvent {
  id: ID;
  title: string;
  text?: string;
  illustration?: string | null;
  /** 3 outcome > 2 war > 1 has choices > 0 other */
  importance?: number;
  outcome?: boolean;
  internal?: boolean;
}

export interface ViewResponse {
  state: PublicState;
  calendar_label: string;
  objectives: Objective[];
  crisis: CrisisView;
  memorials: MemorialItem[];
  pending_choices: PendingChoice[];
  outcome: Outcome | null;
  last_report: TurnReport | null;
  can_advance: boolean;
  /** 终局复盘, present once the game has an outcome */
  review?: FinalReview | null;
  /** 官职—所在—所统—指挥状态 (engine ≥ round 5) */
  command_table?: CommandTable | null;
  /** present when the next settlement reaches the time limit */
  final_notice?: { next_is_final: boolean; last_turn?: number; overtime_possible?: boolean; text: string } | null;
  /** round 9 (§7.1–7.6) */
  agenda?: AgendaView | null;
  replies?: Reply[];
  written_opinions?: Advice[];
  provider_mode?: 'offline' | 'llm' | string;
  tutorial?: TutorialView | null;
}

export interface AgendaSlot {
  used: number;
  limit: number | null;
  left: number | null;
  label: string;
}

export interface AgendaView {
  audience: AgendaSlot;
  debate: AgendaSlot;
  remote_reply?: 'next_season' | 'immediate' | string;
  text?: string;
}

/** 回奏: the answer to last season's 遣使问对 / 书面奏对, delivered at settlement. */
export interface Reply {
  character: ID;
  name?: string;
  mode?: string;
  mode_label?: string;
  question?: string;
  asked_turn?: number;
  turn?: number;
  text: string | null;
  roleplay?: boolean;
  via?: string;
}

export interface TutorialStep {
  turn: number;
  step: number;
  title: string;
  text: string;
  target: string;
}

export interface TutorialView {
  enabled: boolean;
  steps: TutorialStep[];
  total?: number;
}

export interface PresentPerson {
  character: ID;
  name: string;
  present?: boolean;
  region: ID;
  region_name?: string;
  in_transit?: string | Record<string, unknown> | null;
  whereabouts?: string;
  offices?: string[];
}

export interface PresentResponse {
  capital: { id: ID; name: string } | null;
  present: PresentPerson[];
  absent: PresentPerson[];
}

export interface CardParamOption {
  id: ID;
  name: string;
  note?: string;
}

export interface CardParam {
  name: string;
  kind: 'character' | 'office' | 'army' | 'region' | 'amount' | 'choice' | string;
  label?: string;
  options?: CardParamOption[];
  min?: number;
  max?: number;
  default?: number | string | null;
}

export interface PolicyCard {
  id: ID;
  category: string;
  title: string;
  summary: string;
  cost_hint?: string;
  cooldown?: number;
  cooldown_left?: number;
  available: boolean;
  unavailable_reason?: string;
  params: CardParam[];
  illustration?: string | null;
}

export interface ArmyInfo {
  id: ID;
  name: string;
  strength: number;
  quality?: number;
  commander: { id: ID; name: string; present: boolean; note?: string } | null;
  region: ID;
  region_name?: string;
  in_transit?: string | null;
  destination?: ID | null;
  eta_turn?: number | null;
  whereabouts?: string;
  posture?: 'hold' | 'attack' | 'scorch' | string | null;
  posture_label?: string;
  orders: string[];
  cards: ID[];
  autonomy_risk?: '低' | '中' | '高' | string | null;
  etas: Record<ID, number | null>;
}

export interface ArmiesResponse {
  armies: ArmyInfo[];
  regions: { id: ID; name: string; controller?: ID | null }[];
  turn_unit?: string;
}

export interface CommandTable {
  columns?: string[];
  rows: {
    character: ID;
    name: string;
    offices: { id: ID; name: string; station?: ID; station_name?: string; status?: string }[];
    location: { region?: ID; name?: string; in_transit?: unknown; display?: string };
    commands: { army: ID; name: string; strength?: number; station?: ID; station_name?: string; whereabouts?: string; status?: 'present' | 'en_route' | 'remote' | string; label?: string }[];
  }[];
  vacancies?: {
    offices?: { id: ID; name: string; army?: ID }[];
    armies?: { army: ID; name: string; strength?: number; station_name?: string; whereabouts?: string; status?: string; label?: string }[];
  };
  alerts?: string[];
}

export interface CrisisChange {
  title?: string;
  hidden?: boolean;
  total?: number | [number, number] | null;
  total_display?: string;
  items?: { kind: string; kind_label?: string; label?: string; value?: number | [number, number] | null; display?: string }[];
  drift?: { base_display?: string; difficulty_label?: string; difficulty_display?: string; factor?: number; clamp?: unknown; terms?: unknown };
  other?: unknown;
  lines?: string[];
}

export interface FinalReview {
  outcome: Outcome;
  satisfied: string[];
  objectives: Objective[];
  stats: { id: ID; display: string }[];
  highlights: string[];
  turns_played: number;
}

/** One resource's season, step by step: 期初 → 诏令 → 延期执行 → 经常收支 → 事件/选择 → 期末. */
export interface ReconciliationRow {
  resource: ID;
  name: string;
  unit?: string;
  opening: number;
  edicts: number;
  delayed: number;
  regular: number;
  events: number;
  closing: number;
  shown?: Partial<Record<'opening' | 'edicts' | 'delayed' | 'regular' | 'events' | 'closing' | 'rounding', number>>;
  display?: string;
  regular_detail?: { kind: string; label: string; amount?: number; shown?: number; display?: string }[];
  regular_display?: string;
}

export interface ScenarioInfo {
  id: ID;
  title: string;
  era: string;
  version?: string;
  categories?: { id: ID; name: string; hint?: string }[];
  calendar?: Record<string, unknown>;
  asset_ids?: string[];
  theme_css?: string;
  valid?: boolean;
  summary?: string;
}

export interface SessionSummary {
  id: ID;
  scenario: ID;
  turn: number;
  label?: string;
  updated?: string;
}

export interface CreateSessionResponse {
  id: ID;
  scenario: ID;
  state: PublicState;
}

export interface AdoptedOption {
  memorial_id: ID;
  option_id: ID;
}

export interface DraftCardRequest {
  card_id: ID;
  params: Record<string, string | number>;
}

export interface DraftEdictRequest {
  sections: Record<string, string>;
  adopted: AdoptedOption[];
  ops?: Op[];
  cards?: DraftCardRequest[];
}

export type ClauseStatus = 'applied' | 'rejected' | 'delayed' | 'narrative_only' | 'needs_clarification';

export interface Clause {
  category: string;
  text: string;
  status: ClauseStatus;
  op?: Op | null;
  ops?: Op[];
  reason?: string;
  code?: string | null;
  source?: 'memorial' | 'text' | 'client' | 'card' | 'autonomy' | string;
  card_id?: ID;
  card_title?: string;
  cost_hint?: string;
  /** delayed clauses: 有司稽迟 / 驿程 / 将领自主 (§7.3, §7.5) */
  delay_kind?: 'bureaucratic' | 'courier' | 'autonomy' | string;
  autonomy_risk?: '低' | '中' | '高' | string | null;
  autonomy_note?: string;
  memorial_id?: ID;
  option_id?: ID;
  /** engine-rendered human summary of the op */
  summary?: string;
  label?: string;
  group?: number | string;
  /** delayed clauses: why, and the turn they take effect */
  delay_reason?: string;
  due_turn?: number;
}

export interface EdictReceipt {
  id: ID;
  clauses: Clause[];
  execution_rate: number;
  confirmed: boolean;
  state?: PublicState;
}

export interface TurnResponse {
  state: PublicState;
  report: TurnReport;
  memorial: string;
  outcome: Outcome | null;
  replies?: Reply[];
  written_opinions?: Advice[];
}

export interface DebateSpeech {
  character: ID;
  stance: Stance;
  text: string;
  reason?: string;
  /** the memorial option this minister argues for (null for a free topic) */
  target_option_id?: ID | null;
  target_option_label?: string | null;
  against_option_label?: string | null;
  /** 「主张「驳回」，反对「准减赋」」 / 「赞成「议题」」 */
  position?: string;
  proposition?: string;
}

export interface DebateResponse {
  topic?: string;
  proposition?: string;
  memorial?: { id: ID; title: string; options: { id: ID; label: string }[] } | null;
  speeches: DebateSpeech[];
  summary: string;
  /** absent ministers asked for a 书面议状 (delivered next season) */
  written?: { character: ID; name?: string; whereabouts?: string; note?: string }[];
}

export interface Advice {
  id?: ID;
  character: ID;
  text: string;
  source: string;
  turn?: number;
  name?: string;
}

export interface HistoryEntry {
  id: ID;
  type: string;
  turn: number;
  label: string;
  parentId: ID | null;
  timestamp?: string;
}

export interface Health {
  ok: boolean;
  version: string;
  scenarios: string[] | number;
}

export interface UsageRow {
  id: ID;
  kind: string;
  provider: string;
  model: string;
  turn: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

export interface UsageResponse {
  calls: UsageRow[];
  total_tokens: number;
  estimated_cost: number;
  cost_rates_configured: boolean;
}

export interface RoleSetting {
  provider: string;
  model: string;
}

export interface Settings {
  provider?: string;
  base_url?: string;
  model?: string;
  api_key?: string;
  image_provider?: string;
  roles?: Record<string, RoleSetting>;
  provider_configs?: Record<string, { api_key?: string; base_url?: string; model?: string }>;
  input_cost_per_million?: number;
  output_cost_per_million?: number;
  presets?: Record<string, { base_url?: string; model?: string; api_key_url?: string; api_key_env?: string; label?: string; local_cli?: boolean }>;
  [key: string]: unknown;
}

export interface SettingsTestResult {
  ok: boolean;
  tool_calling?: boolean;
  json_fallback?: boolean;
  model?: string;
}

export interface ApiErrorBody {
  detail?: { code?: string; message?: string } | string | { msg?: string }[];
}

export type ChatEvent =
  | { type: 'status'; status: string; mode?: string; mode_label?: string; mode_note?: string }
  | { type: 'message'; text: string }
  | { type: 'deferred'; text: string; agenda?: AgendaView }
  | { type: 'done' }
  | { type: 'error'; code?: string; message: string };
