// Display names for entity ids, and the defence that keeps raw ids out of the UI.
// The engine is meant to send self-contained display text, but any string that still carries a
// known id token ("tang攻yan，胜。") is rewritten with the display name before it reaches a screen.
import meta from 'virtual:tianbao-meta';
import type { PublicState } from '../api/types';

export interface ScenarioEventMeta {
  title: string;
  kind: string;
  choices: boolean;
  /** a system event whose only effect is ledger bookkeeping (岁计定额) — never shown */
  bookkeeping: boolean;
  internal: boolean;
  illustration?: string;
}

export const SCENARIO_META = meta as {
  names: Record<string, string>;
  kinds: Record<string, string>;
  events: Record<string, ScenarioEventMeta>;
  /** ending id → illustration asset id */
  endings: Record<string, string>;
};

const live: Record<string, string> = {};

/** Registers the names carried by a (public) state: runtime armies, renamed offices, etc. */
export function registerStateNames(state: Partial<PublicState> | null | undefined) {
  if (!state) return;
  const groups = [state.factions, state.regions, state.characters, state.armies, state.offices, state.resources] as (Record<string, { name?: string }> | undefined)[];
  for (const group of groups) {
    for (const [id, row] of Object.entries(group ?? {})) if (row && typeof row.name === 'string' && row.name) live[id] = row.name;
  }
}

/** Display name for an id, or null when the id is unknown. */
export function nameOf(id: string | null | undefined): string | null {
  if (!id) return null;
  return live[id] ?? SCENARIO_META.names[id] ?? null;
}

/** All ids the UI knows (scenario + runtime). Used by tests through window.__tianbaoIds. */
export function knownIds(): string[] {
  return [...new Set([...Object.keys(SCENARIO_META.names), ...Object.keys(live)])];
}

const TOKEN = /[A-Za-z][A-Za-z0-9_]*/g;
const SNAKE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

/**
 * Replaces id tokens in a display string with display names. Unknown snake_case tokens (an id
 * the UI has never heard of, e.g. one minted at runtime) become 「某」 rather than leaking.
 * Plain Latin words that are not ids (API, MCP, model names) are left alone.
 */
export function humanize(text: string): string;
export function humanize(text: string | null | undefined): string | null | undefined;
export function humanize(text: string | null | undefined): string | null | undefined {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  return text.replace(TOKEN, (tok, offset: number, whole: string) => {
    // leave URLs, paths and dotted asset ids alone
    const prev = whole[offset - 1];
    const next = whole[offset + tok.length];
    if (prev === '/' || prev === '.' || next === '.' || next === '/' || prev === '%') return tok;
    const name = nameOf(tok);
    if (name) return name;
    return SNAKE.test(tok) ? '某' : tok;
  });
}

// Keys whose string values are player-facing text in API payloads. Identity keys (id, entity,
// region, character, resource, ...) are never touched: the UI still needs them for lookups.
const TEXT_KEYS = new Set([
  'text',
  'display',
  'title',
  'label',
  'summary',
  'line',
  'reason',
  'hint',
  'detail',
  'description',
  'memorial',
  'narrative',
  'result',
  'persona',
  'message',
  'attacker',
  'defender',
  'winner',
  'cause',
  'polished',
  'highlights',
  'satisfied',
  'delay_reason',
  'position',
  'proposition',
  'target_option_label',
  'against_option_label',
  'total_display',
  'kind_label',
  'lines',
  'alerts',
  'regular_display',
  'mode_note',
]);

/** Deep copy of an API payload with every player-facing string humanized. */
export function humanizeDeep<T>(value: T, key = ''): T {
  if (typeof value === 'string') return (TEXT_KEYS.has(key) ? humanize(value) : value) as T;
  if (Array.isArray(value)) return value.map((v) => humanizeDeep(v, key)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = humanizeDeep(v, k);
    return out as T;
  }
  return value;
}

declare global {
  interface Window {
    __tianbaoIds?: () => string[];
  }
}
if (typeof window !== 'undefined') window.__tianbaoIds = knownIds;
