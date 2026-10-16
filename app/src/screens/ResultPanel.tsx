import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { resolveAsset, useAsset, useMapData } from '../api/assets';
import type { Clause, CrisisReport, ReconciliationRow, TurnReport } from '../api/types';
import { EventArt } from '../components/EventArt';
import { MapCrop, MAP_BASE_IDS } from '../components/MapCrop';
import { humanize, nameOf, SCENARIO_META } from '../lib/names';
import { ResourceIcon } from '../components/Icons';
import { CuancaoColumn } from '../components/Ornaments';
import { Paper, Roller } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { useGame } from '../store/game';
import { cls, deltaClass, fmtDelta, fmtNum, fmtRange, fmtValueOrRange } from '../lib/util';
import { CrisisTermRow, termMid } from './desk/Hud';
import { groupClauses } from './EdictPanel';
import { SOURCE_NAMES } from '../lib/court';

const LEDGER_ORDER = ['treasury', 'grain', 'authority', 'morale', 'corruption', 'frontier_pressure', 'fanzhen_power', 'court_strife', 'an_ambition', 'rebellion_risk'];

function Mark({ status }: { status: Clause['status'] }) {
  if (status === 'applied')
    return (
      <svg className="mark mark--ok" viewBox="0 0 40 40" aria-label="施行">
        <path d="M6 22 C 10 24, 13 28, 16 33 C 22 20, 28 12, 36 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  if (status === 'rejected')
    return (
      <svg className="mark mark--no" viewBox="0 0 40 40" aria-label="驳回">
        <path d="M9 9 L 31 31 M31 8 L 9 32" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg className="mark mark--wait" viewBox="0 0 40 40" aria-label={status === 'delayed' ? '迟滞' : '载记'}>
      <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
      {status === 'delayed' && <path d="M20 12 V 21 L 26 25" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />}
    </svg>
  );
}

const RECON_STEPS = [
  ['opening', '期初'],
  ['edicts', '诏令'],
  ['delayed', '延期'],
  ['regular', '收支'],
  ['events', '事件'],
  ['rounding', '取整'],
  ['closing', '期末'],
] as const;

const INTERNAL_KINDS = new Set(['flag', 'counter', 'memory', 'effect_skipped']);
const WAR = /uprising|falls|battle|defeat|revolt|rising|mutiny|raid|talas|tongguan|mawei|flees|rebel|war|反|陷|战|败|叛|乱|兵|围/;

type FiredEvent = { id: string; title: string; text?: string; illustration?: string; importance?: number };
type Featured = { kind: 'art' | 'season'; url: string; title: string; key: string } | { kind: 'map'; region: string; title: string } | { kind: 'none' };

const SEASONS: Record<string, string> = { 春: 'spring', 夏: 'summer', 秋: 'autumn', 冬: 'winter' };
function seasonKey(season: string | undefined, label: string): string {
  if (season && /^(spring|summer|autumn|winter)$/.test(season)) return season;
  const ch = (season ?? '').slice(-1) || label.match(/[春夏秋冬]/g)?.pop() || '春';
  return SEASONS[ch] ?? 'spring';
}

/** Player-facing events of a season, de-duplicated, without bookkeeping/internal ones. */
export function seasonEvents(report: TurnReport | null | undefined): FiredEvent[] {
  const eventFact = (id: string) => (report?.facts ?? []).find((f) => f.kind === 'event' && f.entity === id);
  const seen = new Set<string>();
  const out: FiredEvent[] = [];
  // engine ≥ round 3 sends display rows (most important first); older reports only ids
  const rows: (string | { id: string; title?: string; text?: string; illustration?: string | null; internal?: boolean; outcome?: boolean; importance?: number })[] =
    Array.isArray(report?.events) ? report!.events.filter((e) => !e.outcome) : report?.events_fired ?? [];
  for (const raw of rows) {
    const e = typeof raw === 'string' ? { id: raw } : raw;
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    const meta = SCENARIO_META.events[e.id];
    const fact = eventFact(e.id);
    if (meta?.bookkeeping || meta?.internal || (e as { internal?: boolean }).internal || fact?.internal) continue;
    const title = ('title' in e && e.title) || meta?.title || fact?.display || fact?.text || nameOf(e.id) || '';
    if (!title) continue;
    out.push({
      id: e.id,
      title,
      text: ('text' in e && e.text) || undefined,
      illustration: ('illustration' in e && e.illustration) || meta?.illustration,
      importance: 'importance' in e ? e.importance : undefined,
    });
  }
  return out;
}

/** Most important first: an opened choice, then war, then events with choices, then the rest in order. */
function featureOrder(events: FiredEvent[], report: TurnReport | null | undefined): FiredEvent[] {
  const opened = new Set((report?.choices_opened ?? []).map((c) => (typeof c === 'string' ? c : c.event_id ?? c.id)));
  const featured = report?.featured_event && !report.featured_event.outcome ? report.featured_event.id : null;
  const score = (e: FiredEvent) => {
    const meta = SCENARIO_META.events[e.id];
    if (e.importance != null) return (e.id === featured ? 1000 : 0) + e.importance * 100; // the engine has ranked them
    return (opened.has(e.id) ? 100 : 0) + (WAR.test(`${e.id} ${e.title}`) ? 50 : 0) + (meta?.choices ? 20 : 0);
  };
  return events
    .filter((e) => SCENARIO_META.events[e.id]?.kind !== 'system')
    .map((e, i) => ({ e, s: score(e) - i * 0.01 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
}

export function ResultPanel() {
  const g = useGame();
  const view = g.view!;
  const report: TurnReport | null = g.lastTurn?.report ?? view.last_report;
  const narrative = g.lastTurn?.memorial ?? '';
  const outcome = g.lastTurn?.outcome ?? view.outcome;
  const events = seasonEvents(report);
  const battles = report?.battles ?? [];
  const regionName = (id?: string | null) => (id && (view.state.regions[id]?.name ?? nameOf(id))) || '';
  const who = (id?: string | null) => (id ? nameOf(id) ?? humanize(id) : '');

  // The illustration: the most important player-facing event that has real art; else a detail of
  // the painted map around the season's battlefield (or the capital); else the figure collapses
  // and the scroll widens. Never an empty frame: nothing is drawn until the choice is made.
  const season = seasonKey(view.state.calendar?.season, view.calendar_label);
  const [art, setArt] = useState<{ key: string; hit: Featured | null } | null>(null);
  const [mapData, mapSettled] = useMapData();
  const [mapUrl, mapUrlSettled] = useAsset(MAP_BASE_IDS);
  const featureKey = `${report?.turn ?? ''}|${events.map((e) => e.id).join(',')}|${outcome?.id ?? ''}`;
  useEffect(() => {
    let alive = true;
    (async () => {
      const candidates: { ids: string[]; title: string; key: string }[] = [
        ...(outcome
          ? [
              {
                ids: [report?.events?.find((e) => e.outcome)?.illustration, SCENARIO_META.endings[outcome.id], `ending.${outcome.id}`].filter((x): x is string => Boolean(x)),
                title: outcome.title,
                key: `ending.${outcome.id}`,
              },
            ]
          : []),
        ...featureOrder(events, report).map((e) => ({
          ids: [e.illustration, `event.${e.id}`].filter(Boolean).flatMap((id) => [id!, `${id}.illustration`]),
          title: e.title,
          key: e.id,
        })),
      ];
      const [urls, seasonUrl] = await Promise.all([Promise.all(candidates.map((c) => resolveAsset(c.ids))), resolveAsset([`ui.season.${season}`])]);
      if (!alive) return;
      const i = urls.findIndex(Boolean);
      const quiet = events[0]?.title ?? `${view.calendar_label}·四方无事`;
      setArt({
        key: featureKey,
        hit:
          i >= 0
            ? { kind: 'art', url: urls[i]!, title: candidates[i].title, key: candidates[i].key }
            : seasonUrl
              ? { kind: 'season', url: seasonUrl, title: quiet, key: `ui.season.${season}` }
              : null,
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKey]);
  const battleRegion = battles.find((b) => b.region && view.state.regions[b.region])?.region;
  let shown: Featured | null = null;
  if (art?.key === featureKey) {
    if (art.hit) shown = art.hit;
    else if (mapSettled && mapUrlSettled)
      shown =
        mapData && mapUrl
          ? { kind: 'map', region: battleRegion ?? 'jingji', title: events[0]?.title ?? (battleRegion ? `${regionName(battleRegion)}·战事` : `${view.calendar_label}·四方无事`) }
          : { kind: 'none' };
  }

  const crisis = (report?.crisis ?? {}) as CrisisReport;
  const change = report?.crisis_change ?? null;
  const res = view.state.resources;

  // engine ≥ round 4: a step-by-step reconciliation per public resource
  const recon = new Map((report?.reconciliation ?? []).map((r) => [r.resource, r]));
  const step = (r: ReconciliationRow, k: string): number =>
    (r.shown as Record<string, number | undefined> | undefined)?.[k] ?? (r as unknown as Record<string, number | undefined>)[k] ?? 0;
  const deltaOf = (id: string) => {
    const r = recon.get(id);
    return r ? Math.round((step(r, 'closing') - step(r, 'opening')) * 10) / 10 : g.deltas[id] ?? 0;
  };
  const ledgerIds = [...LEDGER_ORDER, ...[...recon.keys()].filter((id) => !LEDGER_ORDER.includes(id))];
  const deltas = ledgerIds.filter((id) => res[id] && (deltaOf(id) !== 0 || (recon.has(id) && RECON_STEPS.slice(1, -1).some(([k]) => step(recon.get(id)!, k) !== 0))));
  const reasons = (id: string) => {
    const all = (report?.ledger_lines ?? []).filter((l) => l.resource === id);
    const income = all.filter((l) => l.kind === 'income');
    const rest = all.filter((l) => l.kind !== 'income' && l.amount != null);
    const lines = [
      ...(income.length > 2 ? [`${income.length}道收入${fmtDelta(income.reduce((a, l) => a + l.amount, 0))}`] : income.map((l) => `${l.name}${fmtDelta(l.amount)}`)),
      ...rest.map((l) => `${l.name}${fmtDelta(l.amount)}`),
    ];
    const facts = (report?.facts ?? []).filter((f) => f.kind === 'resource' && f.entity === id && !f.internal).map((f) => f.text.replace(/^.*?（(.*)）$/, '$1'));
    return [...lines, ...facts].slice(0, 3).join('，');
  };
  const maxTerm = Math.max(1, ...(crisis.terms ?? []).map((t) => Math.abs(termMid(t.value))));
  const others = (report?.facts ?? []).filter((f) => !['resource', 'event', 'ledger'].includes(f.kind) && !INTERNAL_KINDS.has(f.kind) && !f.internal);
  const crisisRange = Array.isArray(crisis.value_or_estimate) ? crisis.value_or_estimate : null;
  const crisisText =
    crisis.before != null && crisis.value != null
      ? `${Math.round(crisis.before)} → ${Math.round(crisis.value)}`
      : crisisRange
        ? fmtRange(Math.round(crisisRange[0]), Math.round(crisisRange[1]))
        : crisis.display
          ? crisis.display.replace(/[（(]风闻[)）]/, '').replace(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/, (_m, a: string, b: string) => fmtRange(Math.round(Number(a)), Math.round(Number(b))).replace(/^约 /, '')).trim()
          : '';
  const battleText = (b: (typeof battles)[number]) => {
    if (b.text) return b.text;
    const atk = who(b.attacker as string);
    const def = who(b.defender as string);
    const win = b.winner_name || who(b.winner as string);
    if (atk && def) return `${atk}攻${def}${win ? `，${win}胜` : ''}。`;
    return b.result ?? '';
  };
  const next = () => {
    g.closePanel();
    if (outcome) g.setScreen('ending');
  };

  return (
    <PanelShell screen="result" onClose={next} unroll="vertical" closeLabel="合卷">
      <div className={cls('result', shown?.kind === 'none' && 'result--no-figure')}>
        {shown?.kind !== 'none' && (
          <figure className={cls('result-figure', !shown && 'is-pending')} data-testid="result.figure" data-feature={shown?.kind ?? 'pending'} data-feature-id={shown && 'key' in shown ? shown.key : undefined}>
            {shown && (
              <>
                <div className="result-frame">
                  {shown.kind === 'map' ? (
                    <div className="event-art result-art" data-art="map">
                      <MapCrop region={shown.region} />
                    </div>
                  ) : (
                    <EventArt ids={[]} url={shown.url} seed={shown.key} className="result-art" />
                  )}
                </div>
                <figcaption className="t-title">{shown.title}</figcaption>
              </>
            )}
          </figure>
        )}

        <div className="result-scroll">
          <Roller orientation="horizontal" thickness={24} />
          <div className="result-scroll-body">
            <CuancaoColumn width={18} color="rgba(201,162,75,.85)" bg="#30505f" />
            <Paper variant="paper" seed={88} amp={2} sides="lr" className="result-paper">
              <h2 className="result-title t-title">
                <span>推演结果</span>
              </h2>
              <div className="result-season t-title">{view.calendar_label}</div>
              <div className="result-content selectable">
                {g.lastEdict && g.lastEdict.clauses.length > 0 && (
                  <section>
                    <div className="section-label">诏令施行</div>
                    <ul className="result-clauses">
                      {groupClauses(g.lastEdict.clauses).map(({ first: c }, i) => (
                        <li key={i} data-testid={`result.clause.${i}`} data-status={c.status}>
                          <Mark status={c.status} />
                          <span>
                            {c.source && SOURCE_NAMES[c.source] && <small className="result-clause-source">{SOURCE_NAMES[c.source]}　</small>}
                            {c.text}
                            {(c.delay_reason || c.reason) && <small>　{c.delay_reason || c.reason}</small>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {narrative && (
                  <section>
                    <div className="section-label">纪事</div>
                    <p className="result-narrative">{narrative}</p>
                  </section>
                )}
                {battles.length > 0 && (
                  <section>
                    <div className="section-label">战报</div>
                    <ul className="result-battles">
                      {battles.map((b, i) => (
                        <li key={i} data-testid={`result.battle.${i}`}>
                          {b.region && <b className="t-title">{regionName(b.region)}</b>}
                          {battleText(b)}
                          {(b.attacker_loss || b.defender_loss) ? (
                            <small>
                              　攻方折损 {fmtNum(b.attacker_loss ?? 0)}，守方折损 {fmtNum(b.defender_loss ?? 0)}
                            </small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {events.length > 0 && (
                  <section>
                    <div className="section-label">时事</div>
                    <ul className="result-events">
                      {events.map((e) => (
                        <li key={e.id} data-testid={`result.event.${e.id}`}>
                          <b className="t-title">{e.title}</b>
                          {e.text && <span>　{e.text}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {others.length > 0 && (
                  <section>
                    <div className="section-label">有司奏报</div>
                    <ul className="result-facts">
                      {others.map((f, i) => (
                        <li key={i}>{f.display ?? f.text}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {(report?.choices_opened?.length ?? 0) > 0 && <p className="result-choice-note t-title">另有急务{report!.choices_opened!.length}件，待陛下圣裁。</p>}
                {!report && <p className="muted">尚无推演记录。</p>}
              </div>
            </Paper>
            <CuancaoColumn width={18} color="rgba(201,162,75,.85)" bg="#30505f" />
          </div>
          <Roller orientation="horizontal" thickness={24} />
        </div>

        <aside className="result-ledger">
          <Paper variant="silk" seed={31} className="ledger-paper">
            <div className="ledger-title t-title">度支 · 本季增减</div>
            <ul className="ledger-list" data-testid="result.ledger">
              {deltas.length === 0 && <li className="muted">诸项如旧。</li>}
              {deltas.map((id) => {
                const d = deltaOf(id);
                const r = recon.get(id);
                return (
                  <motion.li key={id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + LEDGER_ORDER.indexOf(id) * 0.05 }}>
                    <span className="ledger-icon">
                      <ResourceIcon id={id} size={26} />
                    </span>
                    <span className="ledger-name">
                      {res[id].name}
                      {r ? (
                        <small className="ledger-recon t-num" data-testid={`result.recon.${id}`} title={r.display}>
                          <span className="recon-line">
                            <span className="recon-step">期初 {fmtNum(step(r, 'opening'), 1)}</span>
                            <em aria-hidden="true">→</em>
                            <span className="recon-step recon-step--closing">期末 {fmtNum(step(r, 'closing'), 1)}</span>
                          </span>
                          <span className="recon-line recon-line--steps">
                            {RECON_STEPS.slice(1, -1)
                              .filter(([k]) => step(r, k) !== 0)
                              .map(([k, label]) => (
                                <span key={k} className={cls('recon-step', `recon-step--${k}`)} title={k === 'regular' ? r.regular_display : undefined}>
                                  {label}
                                  {fmtDelta(step(r, k))}
                                </span>
                              ))}
                          </span>
                        </small>
                      ) : (
                        <small>{reasons(id)}</small>
                      )}
                    </span>
                    <b className={cls('ledger-delta t-num', deltaClass(id, d))}>
                      {d > 0 ? '▲' : d < 0 ? '▼' : ''} {fmtDelta(d)}
                    </b>
                  </motion.li>
                );
              })}
            </ul>
            {((crisis.terms?.length ?? 0) > 0 || (change?.items?.length ?? 0) > 0) && (
              <div className="ledger-crisis" data-testid="result.crisis">
                <div className="ledger-title t-title">
                  <span>{view.crisis?.title ?? '渔阳鼙鼓'}</span>
                  {crisisText && <span className="t-num ledger-crisis-value">{crisisText}</span>}
                  {crisis.band && <em>{crisis.band}</em>}
                </div>
                {change && (change.items?.length ?? 0) > 0 && (
                  <div className="crisis-change" data-testid="result.crisisChange">
                    <div className="crisis-change-head">
                      本季变化{change.total_display && <b className="t-num">{change.total_display}</b>}
                    </div>
                    <ul>
                      {change.items!.map((it, i) => (
                        <li key={i}>
                          <span>
                            {it.kind_label && <i>{it.kind_label}</i>}
                            {it.label}
                          </span>
                          <b className="t-num">{it.display ?? fmtValueOrRange(it.value ?? 0, true)}</b>
                        </li>
                      ))}
                    </ul>
                    {(change.drift?.base_display || change.drift?.difficulty_display) && (
                      <p className="crisis-change-drift">
                        {change.drift.base_display && <span>时势漂移 {change.drift.base_display}</span>}
                        {change.drift.difficulty_display && (
                          <span>
                            {change.drift.difficulty_label ?? '难度'} {change.drift.difficulty_display}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {(crisis.terms?.length ?? 0) > 0 && <div className="crisis-change-head">下季预计漂移</div>}
                {(crisis.terms ?? []).map((t) => (
                  <CrisisTermRow key={t.id ?? t.label} term={t} max={maxTerm} paper />
                ))}
              </div>
            )}
          </Paper>
          <button className="btn btn-ink result-next" data-testid="result.next" onClick={next}>
            {outcome ? '观终局' : '下一季'}
          </button>
        </aside>
      </div>
    </PanelShell>
  );
}
