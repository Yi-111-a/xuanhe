// Typed client for the 《天宝》 engine API (docs/CONTRACT.md §2).
// The same code path serves the real engine and the in-process mock: in mock mode
// `fetchImpl` is swapped for the mock router, which answers with real Response objects.
import type {
  Advice,
  AgendaView,
  ApiErrorBody,
  ArmiesResponse,
  ChatEvent,
  CreateSessionResponse,
  DebateResponse,
  DraftEdictRequest,
  EdictReceipt,
  Health,
  HistoryEntry,
  PolicyCard,
  PresentResponse,
  PublicState,
  ScenarioInfo,
  SessionSummary,
  Settings,
  SettingsTestResult,
  TurnResponse,
  UsageResponse,
  ViewResponse,
} from './types';
import { humanizeDeep, registerStateNames } from '../lib/names';

export const SCENARIO_ID = 'tianbao_751';
export const IS_MOCK = import.meta.env.VITE_MOCK === '1' || import.meta.env.MODE === 'mock';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> };
    __tianbaoApiLog?: { method: string; path: string; at: number }[];
  }
}

let basePromise: Promise<string> | null = null;

/** API base: Tauri `get_api_base` command in the desktop shell, else VITE_API_BASE, else localhost:8765. */
export function getApiBase(): Promise<string> {
  if (!basePromise) {
    basePromise = (async () => {
      const tauri = typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : undefined;
      if (tauri?.invoke) {
        try {
          const value = await tauri.invoke('get_api_base');
          if (typeof value === 'string' && value) return value.replace(/\/$/, '');
        } catch {
          /* fall through to env */
        }
      }
      const env = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8765';
      return env.replace(/\/$/, '');
    })();
  }
  return basePromise;
}

let fetchImpl: FetchLike | null = null;

async function getFetch(): Promise<FetchLike> {
  if (fetchImpl) return fetchImpl;
  if (IS_MOCK) {
    const mod = await import('./mock/server');
    fetchImpl = mod.mockFetch;
  } else {
    fetchImpl = (input, init) => window.fetch(input, init);
  }
  return fetchImpl;
}

function logCall(method: string, path: string) {
  if (typeof window === 'undefined') return;
  (window.__tianbaoApiLog ??= []).push({ method, path, at: Date.now() });
  window.dispatchEvent(new CustomEvent('tianbao:api', { detail: { method, path } }));
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  const detail = body?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return new ApiError(res.status, detail.code ?? `HTTP_${res.status}`, detail.message ?? '朝廷未能回复。');
  }
  if (typeof detail === 'string') return new ApiError(res.status, `HTTP_${res.status}`, detail);
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? String(d.msg) : String(d))).join('；');
    return new ApiError(res.status, 'VALIDATION', msg || '请求格式有误。');
  }
  return new ApiError(res.status, `HTTP_${res.status}`, `请求失败（${res.status}）`);
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const doFetch = await getFetch();
  const base = IS_MOCK ? '' : await getApiBase();
  logCall(method, path);
  let res: Response;
  try {
    res = await doFetch(`${base}/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json; charset=utf-8' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', '无法连接推演引擎，请确认引擎已启动。');
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = (text ? JSON.parse(text) : undefined) as T;
  // Game payloads: learn the runtime names first, then make sure no raw id reaches a screen.
  if (data && path.startsWith('/sessions')) {
    registerStateNames((data as { state?: PublicState }).state);
    return humanizeDeep(data);
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>('GET', '/health'),
  scenarios: () => request<ScenarioInfo[]>('GET', '/scenarios'),
  sessions: () => request<SessionSummary[]>('GET', '/sessions'),
  createSession: (scenario: string, seed: number) =>
    request<CreateSessionResponse>('POST', '/sessions', { scenario, seed }),
  deleteSession: (id: string) => request<unknown>('DELETE', `/sessions/${enc(id)}`),
  view: (id: string) => request<ViewResponse>('GET', `/sessions/${enc(id)}/view`),
  draftEdict: (id: string, body: DraftEdictRequest, signal?: AbortSignal) =>
    request<EdictReceipt>('POST', `/sessions/${enc(id)}/edicts/draft`, body, signal),
  confirmEdict: (id: string, edictId: string) =>
    request<EdictReceipt>('POST', `/sessions/${enc(id)}/edicts/${enc(edictId)}/confirm`),
  polishEdict: (id: string, sections: Record<string, string>) =>
    request<{ text: string }>('POST', `/sessions/${enc(id)}/edicts/polish`, { sections }),
  abort: (id: string) => request<{ aborted: boolean }>('POST', `/sessions/${enc(id)}/abort`),
  choose: (id: string, choiceId: string, optionId: string) =>
    request<unknown>('POST', `/sessions/${enc(id)}/choices/${enc(choiceId)}`, { option_id: optionId }),
  advanceTurn: (id: string) => request<TurnResponse>('POST', `/sessions/${enc(id)}/turn`),
  debate: (id: string, topic: string, participants: string[], written: string[] = []) =>
    request<DebateResponse>('POST', `/sessions/${enc(id)}/debate`, written.length ? { topic, participants, written } : { topic, participants }),
  /** who is in the capital (may debate in person) and where the others are (§7.2) */
  present: (id: string) => request<PresentResponse>('GET', `/sessions/${enc(id)}/present`),
  policyCards: (id: string) => request<PolicyCard[]>('GET', `/sessions/${enc(id)}/policy_cards`),
  armies: (id: string) => request<ArmiesResponse>('GET', `/sessions/${enc(id)}/armies`),
  setFlags: (id: string, flags: { tutorial: boolean }) =>
    request<{ session_flags?: Record<string, unknown>; tutorial?: unknown }>('PUT', `/sessions/${enc(id)}/flags`, flags),
  advice: (id: string) => request<Advice[]>('GET', `/sessions/${enc(id)}/advice`),
  saveAdvice: (id: string, advice: Omit<Advice, 'id'>) =>
    request<Advice>('POST', `/sessions/${enc(id)}/advice`, advice),
  history: (id: string) => request<HistoryEntry[]>('GET', `/sessions/${enc(id)}/history`),
  /** structured replay log of the whole game (GET /sessions/{id}/export) */
  exportLog: (id: string) => request<unknown>('GET', `/sessions/${enc(id)}/export`),
  rewind: (id: string, entryId: string) =>
    request<unknown>('POST', `/sessions/${enc(id)}/rewind`, { entry_id: entryId }),
  fork: (id: string, entryId: string | null) =>
    request<{ id: string }>('POST', `/sessions/${enc(id)}/fork`, { entry_id: entryId }),
  usage: () => request<UsageResponse>('GET', '/usage'),
  settings: () => request<Settings>('GET', '/settings'),
  saveSettings: (settings: Partial<Settings>) => request<Settings>('PUT', '/settings', settings),
  testSettings: () => request<SettingsTestResult>('POST', '/settings/test'),
  /**
   * MCP integration commands for this install (GET /api/integration). Returns null when the
   * engine does not offer the route (checked via its OpenAPI listing first, so an older engine
   * never produces a 404 in the console) or in mock mode.
   */
  integration: async (): Promise<unknown | null> => {
    if (IS_MOCK) return null;
    try {
      const base = await getApiBase();
      const spec = (await fetch(`${base}/openapi.json`).then((r) => (r.ok ? r.json() : null))) as { paths?: Record<string, unknown> } | null;
      if (!spec?.paths?.['/api/integration']) return null;
      return await request<unknown>('GET', '/integration');
    } catch {
      return null;
    }
  },

  /** SSE audience chat. Yields parsed events until `done`. */
  async *chat(id: string, character: string, text: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    const doFetch = await getFetch();
    const base = IS_MOCK ? '' : await getApiBase();
    const path = `/sessions/${enc(id)}/chat/${enc(character)}`;
    logCall('POST', path);
    let res: Response;
    try {
      res = await doFetch(`${base}/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'text/event-stream' },
        body: JSON.stringify({ text }),
        signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      throw new ApiError(0, 'NETWORK', '无法连接推演引擎，请确认引擎已启动。');
    }
    if (!res.ok || !res.body) throw await parseError(res);
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '');
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        let payload: Record<string, unknown> = {};
        try {
          payload = data.length ? JSON.parse(data.join('\n')) : {};
        } catch {
          payload = { text: data.join('\n') };
        }
        if (event === 'status')
          yield {
            type: 'status',
            status: String(payload.status ?? ''),
            mode: payload.mode == null ? undefined : String(payload.mode),
            mode_label: payload.mode_label == null ? undefined : String(payload.mode_label),
            mode_note: payload.mode_note == null ? undefined : String(payload.mode_note),
          };
        else if (event === 'message') yield { type: 'message', text: String(payload.text ?? '') };
        else if (event === 'deferred')
          yield { type: 'deferred', text: String(payload.text ?? ''), agenda: (payload.agenda as AgendaView | undefined) ?? undefined };
        else if (event === 'error')
          yield { type: 'error', code: String(payload.code ?? ''), message: String(payload.message ?? '召对中断') };
        else if (event === 'done') {
          yield { type: 'done' };
          return;
        }
      }
    }
    buffer += decoder.decode();
    yield { type: 'done' };
  },
};

export function errorMessage(err: unknown): { code: string; message: string } {
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { code: 'CLIENT', message: err.message };
  return { code: 'CLIENT', message: String(err) };
}
