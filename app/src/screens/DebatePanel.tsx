import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useAsset } from '../api/assets';
import { api } from '../api/client';
import type { DebateResponse } from '../api/types';
import { CuancaoBand } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { Portrait } from '../components/Portrait';
import { useToast } from '../components/Toast';
import { useGame } from '../store/game';
import { cls } from '../lib/util';
import { agendaCount, agendaExhausted, agendaTitle, debateTopicLine } from '../lib/court';
import { STANCE } from './MemorialPanel';

const DEFAULT_PICK = ['li_linfu', 'yang_guozhong', 'yan_zhenqing', 'geshu_han'];

export function DebatePanel() {
  const g = useGame();
  const toast = useToast();
  const view = g.view!;
  const chars = view.state.characters;
  const roster = useMemo(() => Object.values(chars).filter((c) => c.id !== 'xuanzong' && (c.status ?? 'alive') === 'alive'), [chars]);
  const present = g.aux.present;
  useEffect(() => {
    void g.loadPresent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.seasonKey, g.aux.key]);
  const here = useMemo(() => new Set(present?.present.map((p) => p.character) ?? []), [present]);
  const away = useMemo(() => new Map((present?.absent ?? []).map((p) => [p.character, p])), [present]);
  const kept = g.lastDebate && g.lastDebate.key === g.seasonKey ? g.lastDebate : null;
  const [topic, setTopic] = useState(kept?.topic ?? '');
  const [picked, setPicked] = useState<string[]>(() => DEFAULT_PICK.filter((id) => chars[id] && (chars[id].status ?? 'alive') === 'alive').slice(0, 3));
  const [written, setWritten] = useState<string[]>([]);
  // only ministers in the capital may stand in the debate (§7.2)
  useEffect(() => {
    if (present) setPicked((p) => p.filter((id) => here.has(id)));
  }, [present, here]);
  const [result, setResult] = useState<DebateResponse | null>(kept?.result ?? null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ruling, setRuling] = useState('');
  const [bg] = useAsset(['ui.court', 'ui.court.background', 'ui.debate']);

  useEffect(() => {
    if (!result || shown >= result.speeches.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : 900);
    return () => window.clearTimeout(t);
  }, [result, shown]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  const toggleWritten = (id: string) => setWritten((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length >= 6 ? w : [...w, id]));

  const agenda = view.agenda?.debate;
  const exhausted = agendaExhausted(agenda);
  const closedWhy = exhausted ? agendaTitle(agenda, 'debate') : '';

  const start = async () => {
    if (!g.sessionId) return;
    setBusy(true);
    setResult(null);
    setShown(0);
    try {
      const r = await api.debate(g.sessionId, topic.trim(), picked, written);
      setResult(r);
      g.setLastDebate(topic.trim(), r);
      setWritten([]);
      void g.refresh();
    } catch (err) {
      toast.error(err, '廷议未成');
    } finally {
      setBusy(false);
    }
  };
  const canStart = !busy && !exhausted && topic.trim() !== '' && (picked.length >= 2 || (picked.length === 0 && written.length > 0) || (picked.length === 1 && written.length > 0));
  const startWhy = exhausted
    ? closedWhy
    : !topic.trim()
      ? '先定议题'
      : picked.length < 2 && written.length === 0
        ? '在京与议之臣至少二人（或只索书面议状）'
        : undefined;
  const awayRoster = roster.filter((c) => away.has(c.id));
  const hereRoster = present ? roster.filter((c) => here.has(c.id)) : roster;

  const rule = async () => {
    if (!ruling.trim()) return;
    await g.saveAdvice('xuanzong', `廷议「${topic.trim()}」裁决：${ruling.trim()}`, 'debate');
    setRuling('');
  };

  const topics = view.memorials.map((m) => m.title).slice(0, 4);
  const speakers = result ? Array.from(new Set(result.speeches.map((s) => s.character))) : picked;

  return (
    <PanelShell screen="debate" onClose={g.closePanel}>
      <div className="debate" style={bg ? { backgroundImage: `linear-gradient(rgba(20,12,8,.35),rgba(20,12,8,.6)),url(${bg})` } : undefined}>
        <div className="debate-banner">
          <span className="debate-banner-rod" />
          <div className="debate-banner-cloth">
            <CuancaoBand height={12} color="rgba(201,162,75,.9)" />
            <h2 className="panel-title debate-title">廷议</h2>
            <CuancaoBand height={12} color="rgba(201,162,75,.9)" />
          </div>
        </div>

        {!result && (
          <Paper variant="paper" seed={17} className="debate-setup">
            <div className="debate-setup-scroll">
            <div className="section-label">议题</div>
            <input className="field" data-testid="debate.topic" placeholder="如：可否夺安禄山河东之兵？" value={topic} onChange={(e) => setTopic(e.target.value)} />
            {topics.length > 0 && (
              <div className="debate-topics">
                {topics.map((t, i) => (
                  <button key={t} className="btn btn-outline btn-small" data-testid={`debate.topicChip.${i}`} onClick={() => setTopic(t)}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="section-label">
              与议之臣<small className="muted">　在{present?.capital?.name ?? '京'}者择二至四人（已择 {picked.length}）</small>
            </div>
            <div className="debate-roster">
              {hereRoster.map((c) => (
                <button key={c.id} className={cls('debate-pick', picked.includes(c.id) && 'is-on')} data-testid={`debate.pick.${c.id}`} disabled={!picked.includes(c.id) && picked.length >= 4} title={!picked.includes(c.id) && picked.length >= 4 ? '廷议至多四人' : `${c.name}在京，可当廷与议`} onClick={() => toggle(c.id)} aria-pressed={picked.includes(c.id)}>
                  <Portrait id={c.id} className="portrait--chip" />
                  <span className="t-title">{c.name}</span>
                  <small>{c.title}</small>
                </button>
              ))}
            </div>
            {awayRoster.length > 0 && (
              <>
                <div className="section-label">
                  不在京之臣<small className="muted">　不能当廷与议；可索书面议状，其议于下季送达，入谏言库（已索 {written.length}）</small>
                </div>
                <div className="debate-roster debate-roster--away">
                  {awayRoster.map((c) => {
                    const a = away.get(c.id)!;
                    const where = typeof a.in_transit === 'string' && a.in_transit ? a.in_transit : `在${a.region_name ?? ''}`;
                    const on = written.includes(c.id);
                    return (
                      <div key={c.id} className={cls('debate-away', on && 'is-on')}>
                        <button className="debate-pick is-absent" data-testid={`debate.pick.${c.id}`} disabled title={`${c.name}不在京（${where}），不能当场廷议`}>
                          <Portrait id={c.id} className="portrait--chip" />
                          <span className="debate-away-text">
                            <span className="t-title">{c.name}</span>
                            <small>不在京（{where}）</small>
                          </span>
                        </button>
                        <button
                          className={cls('btn btn-small debate-written', on ? 'btn-ink' : 'btn-outline')}
                          data-testid={`debate.written.${c.id}`}
                          aria-pressed={on}
                          disabled={!on && written.length >= 6}
                          title={on ? '撤回：不索其书面议状' : `遣使索${c.name}书面议状，其议于下季送达`}
                          onClick={() => toggleWritten(c.id)}
                        >
                          {on ? '已索书面议状' : '索书面议状'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            </div>
            <div className="debate-setup-actions">
              <span className={cls('agenda-chip t-title', exhausted && 'is-exhausted')} data-testid="debate.agenda" title={agendaTitle(agenda, 'debate')}>
                廷议 {agendaCount(agenda) || '—'}
                {view.agenda?.audience && <small>　召对 {agendaCount(view.agenda.audience)}</small>}
              </span>
              <button className="btn btn-ink btn-ink--red" data-testid="debate.start" disabled={!canStart} title={startWhy} onClick={start}>
                {busy ? '群臣议论中…' : '开议'}
              </button>
              {busy && (
                <span className="ink-loader">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          </Paper>
        )}

        {result && (
          <div className="debate-stage">
            <div className="debate-topic-line t-title" data-testid="debate.topicLine">
              议：{result.proposition ? debateTopicLine(result.proposition) : topic}
            </div>
            {(result.written?.length ?? 0) > 0 && (
              <div className="debate-written-line" data-testid="debate.writtenLine">
                书面议状已发：
                {result.written!.map((w) => `${w.name ?? chars[w.character]?.name ?? ''}（${w.whereabouts ?? ''}）`).join('、')}
                ——其议于下季送达，入谏言库。
              </div>
            )}
            <div className="debate-cards" style={{ gridTemplateColumns: `repeat(${speakers.length}, minmax(0, 1fr))` }}>
              {speakers.map((id) => {
                const own = result.speeches.map((s, i) => ({ ...s, i })).filter((s) => s.character === id && s.i < shown);
                const first = result.speeches.find((s) => s.character === id);
                const stance = STANCE[first?.stance ?? 'neutral'] ?? STANCE.neutral;
                const supports = first?.target_option_label ? `主张「${first.target_option_label}」` : first?.position ?? '';
                return (
                  <div key={id} className="debate-col">
                    <div className="debate-card">
                      <Portrait id={id} className="portrait--card" />
                      <div className="debate-card-name">
                        <b className="t-title">{chars[id]?.name}</b>
                        <span className={cls('stance', stance.cls)}>
                          <i className="t-title">{stance.glyph}</i>
                          {stance.name}
                        </span>
                        {supports && (
                          <small className="debate-position" data-testid={`debate.position.${id}`} title={first?.position}>
                            {supports}
                          </small>
                        )}
                      </div>
                    </div>
                    <AnimatePresence>
                      {own.map((s) => (
                        <motion.div key={s.i} className="speech" data-testid={`debate.speech.${s.i}`} initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}>
                          <p className="selectable">{s.text}</p>
                          <button className="msg-save" data-testid={`debate.saveSpeech.${s.i}`} onClick={() => g.saveAdvice(s.character, s.text, 'debate')}>
                            存谏
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            {shown >= result.speeches.length ? (
              <motion.div className="debate-ruling" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Paper variant="silk" seed={23} className="debate-ruling-paper">
                  <p className="debate-summary t-title">{result.summary}</p>
                  <div className="debate-ruling-row">
                    <input className="field" data-testid="debate.ruling" placeholder="朕意已决……（裁决录入谏言库，可于诏书援引）" value={ruling} onChange={(e) => setRuling(e.target.value)} />
                    <button className="btn btn-ink" data-testid="debate.rule" disabled={!ruling.trim()} onClick={rule}>
                      裁决
                    </button>
                    <button className="btn btn-outline" data-testid="debate.again" disabled={exhausted} title={closedWhy || undefined} onClick={() => setResult(null)}>
                      另议
                    </button>
                  </div>
                </Paper>
              </motion.div>
            ) : (
              <div className="debate-wait">
                <button className="btn btn-outline btn-small" data-testid="debate.skip" onClick={() => setShown(result.speeches.length)}>
                  略过
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PanelShell>
  );
}
