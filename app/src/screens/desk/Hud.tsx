// Desk HUD: lacquer resource bar, calendar slip + turn dots + objectives, faction ribbons,
// the 胡马南牧 crisis beacon, ink medallion column, memorial book, edict scroll, layer switcher.
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { CrisisTerm, CrisisView, PublicState, ViewResponse } from '../../api/types';
import { ResourceIcon } from '../../components/Icons';
import { Baoxiang, CornerFlourish } from '../../components/Ornaments';
import type { MapLayer } from '../../store/game';
import { cls, deltaClass, fmtDelta, fmtRange, fmtValueOrRange, resourceValueText } from '../../lib/util';

// ---------------------------------------------------------------- resource bar
const BAR_RESOURCES = ['treasury', 'grain', 'authority', 'morale', 'ningxing', 'dongnan', 'wubei', 'liao_zuo', 'corruption'];

const DRIFT_NOTES: Record<string, string> = {
  authority: '倦政：每季自减 0.25；佞幸用事逾六十则更甚。',
  morale: '吏治积弊逾五十五、东南民怨逾七十，民心逐季流失；太平无事则稍复。',
  corruption: '佞幸用事逾六十，吏治逐季更坏；稽迟之诏与风闻之谬皆由此。',
  ningxing: '蔡、王、童、梁、朱、高诸人用事之势。罢黜之、起用正人则降；它推高金人轻宋与胡马南牧。',
  dongnan: '花石纲、应奉、免夫钱之苦逐季累积；逾六十六，方腊之变将起。',
  wubei: '禁军阙额、河北边防、器甲。不修则逐季废弛；武备愈高，金人愈不敢轻宋。',
  liao_zuo: '辽的残余国力，宋之北方屏障。辽祚尚在，金人西顾，南侵之势折减；辽亡则宋与金直接为邻。',
  jin_contempt: '金人对宋的轻视：伐燕不克、赎燕、纳叛而又杀之、失信、武备废弛都会推高它。只知风闻区间。',
  nanmu: '由金势日张、金人轻宋、武备、佞幸误国、君威、朝野戒备六项合成。',
};

export function ResourceBar({ view, deltas }: { view: ViewResponse; deltas: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = pinned ?? open;
  const state = view.state;
  return (
    <div className="resbar lacquer on-dark" data-testid="resources.bar" data-hud="resources">
      <CornerFlourish className="resbar-corner resbar-corner--l" size={30} />
      <CornerFlourish className="resbar-corner resbar-corner--r" size={30} rotate={90} />
      {BAR_RESOURCES.filter((id) => state.resources[id]).map((id) => {
        const r = state.resources[id];
        const d = deltas[id] ?? 0;
        return (
          <button
            key={id}
            className={cls('res-item', shown === id && 'is-open')}
            data-testid={`resources.item.${id}`}
            onMouseEnter={() => setOpen(id)}
            onMouseLeave={() => setOpen((o) => (o === id ? null : o))}
            onFocus={() => setOpen(id)}
            onBlur={() => setOpen((o) => (o === id ? null : o))}
            onClick={() => setPinned((p) => (p === id ? null : id))}
            aria-label={`${r.name} ${resourceValueText(r)}`}
          >
            <span className="res-icon">
              <ResourceIcon id={id} size={24} />
            </span>
            <span className="res-text">
              <span className="res-name t-title">{r.name}</span>
              <span className="res-value t-num">
                {resourceValueText(r)}
                {d !== 0 && <em className={cls('res-delta', deltaClass(id, d))}>{d > 0 ? '▲' : '▼'}{fmtDelta(d).replace(/^[+−]/, '')}</em>}
              </span>
            </span>
          </button>
        );
      })}
      <AnimatePresence>
        {shown && state.resources[shown] && (
          <ResourceBreakdown key={shown} id={shown} view={view} delta={deltas[shown] ?? 0} pinned={pinned === shown} onClose={() => setPinned(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResourceBreakdown({ id, view, delta, pinned, onClose }: { id: string; view: ViewResponse; delta: number; pinned: boolean; onClose: () => void }) {
  const r = view.state.resources[id];
  const report = view.last_report;
  const raw = (report?.ledger_lines ?? []).filter((l) => l.resource === id);
  const income = raw.filter((l) => l.kind === 'income');
  const lines =
    income.length > 3
      ? [{ name: `各道收入（${income.length}道）`, amount: Math.round(income.reduce((a, l) => a + l.amount, 0) * 10) / 10, kind: 'income', resource: id, reason: '' }, ...raw.filter((l) => l.kind !== 'income')]
      : raw;
  const facts = (report?.facts ?? []).filter((f) => f.kind === 'resource' && f.entity === id && !lines.some((l) => f.text.includes(l.name)));
  const recurring = (view.state.ledger ?? []).filter((l) => (l.resource ?? 'treasury') === id && l.kind === 'recurring');
  const idx = BAR_RESOURCES.indexOf(id);
  return (
    <motion.div
      className={cls('popover lacquer res-pop', pinned && 'is-pinned')}
      data-testid="resources.breakdown"
      style={{ left: Math.max(0, idx * 104 - 20) }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18 }}
    >
      <h4>
        {r.name}
        <span className="res-pop-val t-num">
          {resourceValueText(r)}
          {r.unit && r.unit !== '点' ? ` ${r.unit}` : ''}
        </span>
      </h4>
      {r.hidden && <p className="res-pop-note">此数不可确知，所见为风闻区间。吏治愈坏，风闻愈谬；遣心腹察访可收窄。</p>}
      {delta !== 0 && (
        <div className="res-pop-row res-pop-total">
          <span>上季增减</span>
          <b className={cls('t-num', deltaClass(id, delta))}>{fmtDelta(delta)}</b>
        </div>
      )}
      {lines.length > 0 && <div className="res-pop-head">上季账目</div>}
      {lines.map((l, i) => (
        <div key={i} className="res-pop-row">
          <span>
            {l.name}
            {l.reason && <small>　{l.reason}</small>}
          </span>
          <b className={cls('t-num', deltaClass(id, l.amount))}>{fmtDelta(l.amount)}</b>
        </div>
      ))}
      {facts.slice(0, 6).map((f, i) => (
        <div key={`f${i}`} className="res-pop-row">
          <span>{f.text}</span>
        </div>
      ))}
      {recurring.length > 0 && <div className="res-pop-head">常例收支（每季）</div>}
      {recurring.map((l) => (
        <div key={l.id} className="res-pop-row">
          <span>
            {l.name}
            {l.reason && <small>　{l.reason}</small>}
          </span>
          <b className={cls('t-num', deltaClass(id, l.amount))}>{fmtDelta(l.amount)}</b>
        </div>
      ))}
      {DRIFT_NOTES[id] && <p className="res-pop-note">{DRIFT_NOTES[id]}</p>}
      {!lines.length && !recurring.length && !facts.length && !DRIFT_NOTES[id] && !r.hidden && <p className="res-pop-note">上季无账可查。</p>}
      {pinned && (
        <button className="res-pop-close" data-testid="resources.breakdown.close" onClick={onClose} aria-label="收起">
          ×
        </button>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------- calendar, turn dots, objectives
const TOTAL_TURNS = 24;
/** 宣和七年冬：史载金兵南下、徽宗内禅之季（常规时限的最后一季） */
const FATE_TURN = 23;
export function CalendarSlip({ view }: { view: ViewResponse }) {
  const turn = view.state.turn;
  const year = 1120 + Math.floor(turn / 4);
  return (
    <div className="calendar-slip" data-testid="desk.calendar" data-hud="calendar">
      <div className="calendar-paper">
        <div className="calendar-label t-title">{view.calendar_label}</div>
        <div className="calendar-ad t-num">公元 {year} 年 · 第 {turn + 1} 季</div>
      </div>
      <div className="turn-dots" aria-label={`第${turn + 1}季，共${TOTAL_TURNS}季`}>
        {Array.from({ length: Math.max(TOTAL_TURNS, turn + 1) }, (_, i) => (
          <span
            key={i}
            className={cls('turn-dot', i < turn && 'is-past', i === turn && 'is-now', i === FATE_TURN && 'is-fate', i % 4 === 0 && 'is-year')}
            title={i === FATE_TURN ? '宣和七年冬：史载金兵南下、徽宗内禅之季' : i >= TOTAL_TURNS ? '金兵南下之后的加时（宣和八年）' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Engine statuses vary (ok / on_track / at_risk / failed …); map them to three tones. */
export function objectiveTone(status: string): 'ok' | 'warn' | 'fail' {
  if (/fail|lost|broken|miss/.test(status)) return 'fail';
  if (/warn|risk|danger|threat/.test(status)) return 'warn';
  return 'ok';
}

export function Objectives({ view }: { view: ViewResponse }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="objectives" data-hud="objectives">
      {view.objectives.map((o, i) => (
        <button
          key={o.id}
          className={cls('objective', `objective--${objectiveTone(o.status)}`)}
          data-testid={`desk.objective.${o.id}`}
          onMouseEnter={() => setOpen(o.id)}
          onMouseLeave={() => setOpen(null)}
          onClick={() => setOpen((x) => (x === o.id ? null : o.id))}
        >
          <span className="objective-num t-title">{['一', '二', '三', '四'][i] ?? i + 1}</span>
          <span className="objective-title t-title">{o.title}</span>
          <AnimatePresence>
            {open === o.id && o.detail && (
              <motion.span className="objective-tip lacquer" data-testid="desk.objective.detail" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {o.detail}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- faction ribbons
interface RibbonDef {
  id: string;
  glyph: string;
  name: string;
  leader: string;
  color: string;
  influence: (s: PublicState) => number;
  note: string;
}
const amt = (s: PublicState, id: string) => s.resources[id]?.amount ?? (s.resources[id]?.estimate ? (s.resources[id].estimate![0] + s.resources[id].estimate![1]) / 2 : 50);
const alive = (s: PublicState, id: string) => (s.characters[id]?.status ?? 'alive') === 'alive';
const nOffices = (s: PublicState, id: string) => s.characters[id]?.offices?.length ?? (s.characters[id]?.office ? 1 : 0);

const RIBBONS: RibbonDef[] = [
  { id: 'cai', glyph: '蔡', name: '蔡党', leader: 'cai_jing', color: 'zise', note: '公相四度入相，门生故吏遍天下。', influence: (s) => (alive(s, 'cai_jing') ? 26 + nOffices(s, 'cai_jing') * 18 + amt(s, 'ningxing') * 0.3 : 6 + amt(s, 'ningxing') * 0.15) },
  { id: 'xingchen', glyph: '王', name: '幸臣', leader: 'wang_fu', color: 'zhusha', note: '王黼骤贵，应奉之求、取燕之议皆出其门。', influence: (s) => (alive(s, 'wang_fu') ? 18 + nOffices(s, 'wang_fu') * 16 + amt(s, 'ningxing') * 0.45 : 6 + amt(s, 'ningxing') * 0.2) },
  { id: 'neishi', glyph: '童', name: '内侍', leader: 'tong_guan', color: 'shiqing', note: '童贯掌兵柄，梁师成掌御笔，号「媪相」「隐相」。', influence: (s) => 14 + nOffices(s, 'tong_guan') * 14 + nOffices(s, 'liang_shicheng') * 12 + amt(s, 'ningxing') * 0.25 },
  { id: 'qingyi', glyph: '李', name: '清议', leader: 'li_gang', color: 'shilv', note: '李纲、宗泽、张叔夜与太学诸生，主修武备、远小人。', influence: (s) => 10 + nOffices(s, 'li_gang') * 16 + (100 - amt(s, 'ningxing')) * 0.45 + amt(s, 'authority') * 0.1 },
];

export function FactionRibbons({ view, onSummon }: { view: ViewResponse; onSummon: (characterId: string) => void }) {
  const [tip, setTip] = useState<string | null>(null);
  return (
    <div className="ribbons" data-testid="desk.ribbons" data-hud="ribbons">
      <div className="ribbon-rod" aria-hidden="true" />
      {RIBBONS.map((r) => {
        const value = Math.max(0, Math.min(100, r.influence(view.state)));
        const leader = view.state.characters[r.leader];
        const dead = leader && leader.status && leader.status !== 'alive';
        return (
          <button
            key={r.id}
            className={cls('ribbon', `ribbon--${r.color}`, dead && 'is-faded')}
            style={{ ['--len' as string]: `${84 + value * 0.7}px` }}
            data-testid={`desk.ribbon.${r.id}`}
            onMouseEnter={() => setTip(r.id)}
            onMouseLeave={() => setTip(null)}
            onClick={() => !dead && onSummon(r.leader)}
            aria-label={`${r.name} 势力 ${Math.round(value)}`}
          >
            <span className="ribbon-cloth">
              <span className="ribbon-seal t-title">{r.glyph}</span>
              <span className="ribbon-pearls" aria-hidden="true" />
            </span>
            <AnimatePresence>
              {tip === r.id && (
                <motion.span className="ribbon-tip lacquer on-dark" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <b className="t-title">{r.name}</b>
                  <span>
                    {leader?.name ?? ''}　势 <span className="t-num">{Math.round(value)}</span>
                  </span>
                  <small>{dead ? `${leader?.name}已不在朝。` : r.note}</small>
                  {!dead && <small className="ribbon-tip-act">点击召对{leader?.name}</small>}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- crisis drum
export function bandColor(band: string, bands?: CrisisView['bands']): string {
  const names = (bands ?? []).map((b) => b.name);
  const idx = names.indexOf(band);
  const i = idx >= 0 ? idx : ['承平', '边声', '山雨', '铁骑'].indexOf(band);
  return ['var(--crisis-calm)', 'var(--crisis-rumor)', 'var(--crisis-storm)', 'var(--crisis-fire)'][Math.max(0, i)] ?? 'var(--crisis-calm)';
}

export function CrisisDrum({ view }: { view: ViewResponse }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const c = view.crisis;
  const value = Array.isArray(c.value_or_estimate) ? (c.value_or_estimate[0] + c.value_or_estimate[1]) / 2 : c.value_or_estimate;
  const label = Array.isArray(c.value_or_estimate)
    ? fmtRange(Math.round(c.value_or_estimate[0]), Math.round(c.value_or_estimate[1]), false, false)
    : `${Math.round(value)}`;
  const bands = c.bands?.length ? c.bands : [{ max: 39, name: '承平' }, { max: 54, name: '边声' }, { max: 69, name: '山雨' }, { max: 100, name: '铁骑' }];
  const color = bandColor(c.band, bands);
  const R = 48;
  const arc = (from: number, to: number) => {
    const a0 = (-220 + (from / 100) * 260) * (Math.PI / 180);
    const a1 = (-220 + (to / 100) * 260) * (Math.PI / 180);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${R * Math.cos(a0)} ${R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)}`;
  };
  const needle = (-220 + (Math.max(0, Math.min(100, value)) / 100) * 260) * (Math.PI / 180);
  const severity = bands.findIndex((b) => b.name === c.band);
  const maxTerm = Math.max(1, ...c.terms.map((t) => Math.abs(termMid(t.value))));
  const show = hover || pinned;
  const hidden = view.state.resources.jin_contempt;
  return (
    <div className="crisis" data-hud="crisis" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button className={cls('crisis-drum', severity >= 2 && 'is-alarm', severity >= 3 && 'is-fire')} data-testid="desk.crisis" onClick={() => setPinned((p) => !p)} aria-label={`${c.title ?? '胡马南牧'} ${label} ${c.band}`} style={{ ['--band' as string]: color }}>
        <svg viewBox="-70 -70 140 140" width="132" height="132" aria-hidden="true">
          <defs>
            {/* 青瓷盘面：汝窑天青，冰裂淡纹 */}
            <radialGradient id="drumskin" cx="45%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#eef1e4" />
              <stop offset="70%" stopColor="#cdd8c6" />
              <stop offset="100%" stopColor="#97ab9d" />
            </radialGradient>
          </defs>
          <circle r="66" fill="#141b19" stroke="#b7a271" strokeWidth="2" />
          <circle r="60" fill="#2c4540" />
          {Array.from({ length: 24 }, (_, i) => (
            <path
              key={i}
              d={`M${57 * Math.cos((i / 24) * Math.PI * 2)} ${57 * Math.sin((i / 24) * Math.PI * 2)} L ${(i % 6 === 0 ? 64 : 61) * Math.cos((i / 24) * Math.PI * 2)} ${(i % 6 === 0 ? 64 : 61) * Math.sin((i / 24) * Math.PI * 2)}`}
              stroke="#d9cfa6"
              strokeOpacity={i % 6 === 0 ? 0.9 : 0.5}
              strokeWidth={i % 6 === 0 ? 1.6 : 0.9}
            />
          ))}
          <circle r="56" fill="url(#drumskin)" />
          {bands.map((b, i) => (
            <path key={b.name} d={arc(i === 0 ? 0 : bands[i - 1].max + 1, b.max)} stroke={bandColor(b.name, bands)} strokeWidth="8" fill="none" opacity={i === severity ? 1 : 0.45} strokeLinecap="butt" />
          ))}
          <g transform={`rotate(${(needle * 180) / Math.PI})`}>
            <path d="M37 0 L 27 -6 L 27 6 Z" fill="#1b1d1b" stroke="#eef1e4" strokeWidth="1" />
            <circle cx="49" cy="0" r="6.5" fill={color} stroke="#1b1d1b" strokeWidth="1.6" />
          </g>
        </svg>
        <span className={cls('crisis-value t-num', Array.isArray(c.value_or_estimate) && 'crisis-value--range')}>{label}</span>
        <span className="crisis-band t-title">{c.band}</span>
        <span className="crisis-title t-title">{c.title ?? '胡马南牧'}</span>
      </button>
      <AnimatePresence>
        {show && (
          <motion.div className={cls('popover lacquer on-dark crisis-pop', pinned && 'is-pinned')} data-testid="desk.crisis.breakdown" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}>
            {pinned && (
              <button className="res-pop-close" data-testid="desk.crisis.close" onClick={() => setPinned(false)} aria-label="收起">
                ×
              </button>
            )}
            <h4>
              {c.title ?? '胡马南牧'}·{c.band}
            </h4>
            <p className="res-pop-note">金人南侵之势逐季由下列各项推动，正值推高，负值压低。至「铁骑」（七十）以上而辽已亡，金兵随时可能南下。</p>
            {c.terms.map((t) => (
              <CrisisTermRow key={t.id ?? t.label} term={t} max={maxTerm} />
            ))}
            {hidden?.hidden && hidden.estimate && (
              <div className="res-pop-row">
                <span>金人轻宋（风闻）</span>
                <b className="t-num">{fmtRange(Math.round(hidden.estimate[0]), Math.round(hidden.estimate[1]))}</b>
              </div>
            )}
            <div className="crisis-bands">
              {bands.map((b, i) => (
                <span key={b.name} style={{ ['--band' as string]: bandColor(b.name, bands) }} className={cls(i === severity && 'is-now')}>
                  {b.name}
                  <small className="t-num">≤{b.max}</small>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const termMid = (v: number | [number, number]) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);

export function CrisisTermRow({ term, max, paper }: { term: CrisisTerm; max: number; paper?: boolean }) {
  const mid = termMid(term.value);
  const text = fmtValueOrRange(term.value, true);
  return (
    <div className={cls('crisis-term', paper && 'crisis-term--paper', Array.isArray(term.value) && 'is-estimate')} title={term.display}>
      <span className="crisis-term-label">{term.label}</span>
      <span className="crisis-term-bar">
        <span className="crisis-term-mid" />
        <span className={cls('crisis-term-fill', mid >= 0 ? 'is-up' : 'is-down')} style={{ width: `${(Math.abs(mid) / max) * 50}%`, [mid >= 0 ? 'left' : 'right']: '50%' }} />
      </span>
      <b className={cls('t-num crisis-term-value', mid > 0 ? 'delta-up-bad' : mid < 0 ? 'delta-down-good' : '')}>{text}</b>
    </div>
  );
}

// ---------------------------------------------------------------- medallions
export function Medallion({
  glyph,
  label,
  testid,
  onClick,
  badge,
  count,
  exhausted,
  title,
}: {
  glyph: string;
  label: string;
  testid: string;
  onClick: () => void;
  badge?: number;
  /** 朝会日程: 「已用/上限」 shown under the label */
  count?: string;
  /** the season's quota is used up (the panel still opens, read-only) */
  exhausted?: boolean;
  title?: string;
}) {
  return (
    <button className={cls('medallion', exhausted && 'is-exhausted')} data-testid={testid} onClick={onClick} aria-label={title ?? label} title={title}>
      <span className="medallion-disc">
        <span className="medallion-glyph t-title">{glyph}</span>
      </span>
      <span className="medallion-label t-title">
        {label}
        {count && (
          <span className="medallion-count t-num" data-testid={`${testid}.count`}>
            {count}
          </span>
        )}
      </span>
      {badge ? <span className="medallion-badge t-num">{badge}</span> : null}
    </button>
  );
}

/** 回奏: lacquered courier box on the desk; the badge counts replies not yet read this season. */
export function RepliesBox({ count, unread, onOpen }: { count: number; unread: number; onOpen: () => void }) {
  const tip = count ? `回奏 ${count} 件${unread ? `（未读 ${unread}）` : ''}：上季遣使所问，本季驿递送到` : '本季无回奏。遣使问对不在京之臣，其回奏于下季送达';
  return (
    <button className={cls('replies-box', count > 0 && 'has-mail')} data-testid="desk.replies" data-hud="replies" onClick={onOpen} aria-label={tip} title={tip}>
      <span className="replies-lid" />
      <span className="replies-body">
        <span className="replies-seal t-title" aria-hidden="true">
          驿
        </span>
        <span className="replies-label t-title">回奏</span>
      </span>
      {unread > 0 && <span className="object-badge t-num">{unread}</span>}
    </button>
  );
}

// ---------------------------------------------------------------- memorial book & edict scroll
export function MemorialBook({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="memorial-book" data-testid="desk.memorialBook" data-hud="memorials" onClick={onOpen} aria-label={`奏疏 ${count} 件`}>
      <span className="book-page book-page--3" />
      <span className="book-page book-page--2" />
      <span className="book-cover">
        <span className="book-stitch" />
        <span className="book-slip t-title">奏疏</span>
        <span className="book-flower">
          <Baoxiang size={54} color="rgba(183,162,113,.55)" inner="rgba(183,162,113,.25)" />
        </span>
      </span>
      {count > 0 && <span className="object-badge t-num">{count}</span>}
    </button>
  );
}

export function EdictScroll({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="edict-scroll" data-testid="desk.edictScroll" data-hud="edict" onClick={onOpen} aria-label="拟诏">
      <span className="scroll-body">
        <span className="scroll-cap scroll-cap--l" />
        <span className="scroll-brocade" />
        <span className="scroll-cap scroll-cap--r" />
        <span className="scroll-cord" />
      </span>
      <span className="scroll-tag t-title">拟诏</span>
      {count > 0 && <span className="object-badge t-num">{count}</span>}
    </button>
  );
}

// ---------------------------------------------------------------- layer switcher
export const LAYERS: { id: MapLayer; name: string }[] = [
  { id: 'jurisdiction', name: '疆域' },
  { id: 'morale', name: '治安' },
  { id: 'troops', name: '兵力' },
  { id: 'canal', name: '漕运' },
  { id: 'beacon', name: '北边烽燧' },
];

const LEGENDS: Record<MapLayer, { c: string; t: string }[]> = {
  jurisdiction: [
    { c: 'var(--nijin)', t: '东京、西京' },
    { c: 'var(--shilv)', t: '新复之地' },
    { c: 'var(--zheshi)', t: '辽' },
    { c: 'var(--mo-soft)', t: '金' },
    { c: 'var(--zhusha)', t: '陷敌之地' },
  ],
  morale: [
    { c: 'var(--shilv)', t: '安堵' },
    { c: 'var(--nijin)', t: '尚可' },
    { c: 'var(--zhusha)', t: '不靖' },
  ],
  troops: [{ c: 'var(--shiqing)', t: '色愈深，兵愈众' }],
  canal: [
    { c: 'var(--nijin)', t: '东南漕运（江南运河、汴河）' },
    { c: 'var(--zhusha)', t: '漕路受阻' },
  ],
  beacon: [{ c: 'var(--zhusha)', t: '烽燧：胡马南牧愈急，火愈盛' }],
};

export function LayerSwitcher({ layer, onChange }: { layer: MapLayer; onChange: (l: MapLayer) => void }) {
  return (
    <div className="layers" data-hud="layers">
      <div className="layer-tabs lacquer on-dark" role="tablist" aria-label="舆图图层">
        {LAYERS.map((l) => (
          <button key={l.id} role="tab" aria-selected={layer === l.id} className={cls('layer-tab t-title', layer === l.id && 'is-on')} data-testid={`map.layer.${l.id}`} disabled={layer === l.id} onClick={() => onChange(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="layer-legend" data-testid="map.legend">
        {LEGENDS[layer].map((x) => (
          <span key={x.t}>
            <i style={{ background: x.c }} />
            {x.t}
          </span>
        ))}
      </div>
    </div>
  );
}
