// Round-9 court rules as the UI shows them (docs/CONTRACT.md §7): agenda quotas, courier dates,
// receipt delay kinds and autonomy risk, and which 回奏 the player has already read.
import type { AgendaSlot, Clause } from '../api/types';

/** 「1/3」, or 「不限」 when the scenario sets no quota. */
export function agendaCount(slot: AgendaSlot | null | undefined): string {
  if (!slot) return '';
  return slot.limit == null ? '不限' : `${slot.used}/${slot.limit}`;
}

export function agendaExhausted(slot: AgendaSlot | null | undefined): boolean {
  return Boolean(slot && slot.limit != null && (slot.left ?? slot.limit - slot.used) <= 0);
}

/** Tooltip for a quota: what is used, what is left, or why the action is closed this season. */
export function agendaTitle(slot: AgendaSlot | null | undefined, kind: 'audience' | 'debate'): string {
  const name = kind === 'audience' ? '召对' : '廷议';
  if (!slot || slot.limit == null) return `${name}：本季不限次数`;
  if (agendaExhausted(slot)) return `本季${name}已满（${slot.used}/${slot.limit}），下季结算后重置`;
  const note = kind === 'audience' ? '；面见、书面奏对、遣使问对都算一次' : '；只有在京者能当廷与议';
  return `本季${name}已用 ${slot.used} 次，上限 ${slot.limit} 次，尚余 ${slot.left ?? slot.limit - slot.used} 次${note}`;
}

const SEASONS = ['春', '夏', '秋', '冬'];
/** 「迟到之报（去岁冬事）」 for a memorial that reached the court a season late. */
export function lateLabel(originTurn: number | null | undefined, turn: number): string {
  if (originTurn == null) return '迟到之报（上季之事）';
  const season = SEASONS[((originTurn % 4) + 4) % 4];
  const sameYear = Math.floor(originTurn / 4) === Math.floor(turn / 4);
  return `迟到之报（${sameYear ? '今岁' : '去岁'}${season}季事）`;
}

export const SOURCE_NAMES: Record<string, string> = {
  memorial: '奏疏',
  card: '政令卡',
  text: '御笔',
  client: '军令',
  autonomy: '将领自主',
};

/** 有司稽迟 / 驿程遥远（令达于下季） / 将领自主 — the three ways a clause is put off. */
export function delayKindLabel(c: Clause): string | null {
  if (c.status !== 'delayed') return null;
  const kind = c.delay_kind ?? (/驿程|令达/.test(c.delay_reason ?? '') ? 'courier' : 'bureaucratic');
  if (kind === 'courier') return '驿程遥远（令达于下季）';
  if (kind === 'autonomy') return '将领自主';
  return '有司稽迟';
}

export function riskClass(level: string | null | undefined): string {
  return level === '高' ? 'risk--high' : level === '中' ? 'risk--mid' : 'risk--low';
}

const readKey = (season: string) => `tianbao.repliesRead.${season}`;
export function repliesRead(season: string): number {
  try {
    return Number(localStorage.getItem(readKey(season)) ?? 0) || 0;
  } catch {
    return 0;
  }
}
export function markRepliesRead(season: string, count: number) {
  try {
    localStorage.setItem(readKey(season), String(count));
  } catch {
    /* storage blocked: the badge just stays */
  }
  window.dispatchEvent(new CustomEvent('tianbao:replies-read'));
}

/** Army quality as a word (兵质 multiplier around 1.0). */
export function qualityWord(q: number | undefined): string {
  if (q == null) return '';
  return q >= 1.1 ? '精锐' : q >= 0.95 ? '可用' : q >= 0.75 ? '平平' : '羸弱';
}

/** The debate proposition as the engine writes it is for model clients: option ids in backticks, the
 *  whole option list, how to name a proposal by option_id. On the desk it reads as the memorial and
 *  the proposal only: 「就奏疏「河东节度出缺」，所议之案为「照准，并赐铁券」（奏疏所请）：赞成即主此案，反对即主他案」. */
export function debateTopicLine(text: string): string {
  return text
    .replace(/`[^`]*`[，,]?/g, '')
    .replace(/诸选项择一（.*?）；(?=所议之案|诸案并陈)/, '，')
    .replace(/（可用 option_id[^）]*）/, '')
    .replace(/；各人立场附所主张的选项$/, '')
    .replace(/：各人只列所主张的选项，不以首个选项为案$/, '')
    .replace(/（）/g, '');
}
