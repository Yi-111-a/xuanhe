import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { EventArt } from '../components/EventArt';
import { Baoxiang, CuancaoBand, CuancaoColumn } from '../components/Ornaments';
import { Paper, Roller } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';
import { cls } from '../lib/util';
import { lateLabel } from '../lib/court';

export const STANCE: Record<string, { glyph: string; name: string; cls: string }> = {
  support: { glyph: '可', name: '附议', cls: 'stance--support' },
  oppose: { glyph: '否', name: '反对', cls: 'stance--oppose' },
  neutral: { glyph: '中', name: '持中', cls: 'stance--neutral' },
};

export function MemorialPanel() {
  const g = useGame();
  const view = g.view!;
  const items = view.memorials;
  const [sel, setSel] = useState(items[0]?.id ?? null);
  const item = items.find((m) => m.id === sel) ?? items[0];
  const adoptedFor = (id: string) => g.draft.adopted.find((a) => a.memorial_id === id);
  const chars = view.state.characters;

  return (
    <PanelShell screen="memorial" onClose={g.closePanel} unroll="vertical">
      <div className="hanging-scroll">
        <Roller orientation="horizontal" thickness={28} />
        <div className="hanging-body">
          <CuancaoColumn width={24} color="rgba(201,162,75,.9)" bg="#2b4b5e" className="hanging-border" />
          <Paper variant="silk" seed={4} amp={2} sides="lr" className="memorial-paper">
            <header className="memorial-head">
              <Baoxiang size={34} />
              <CuancaoBand height={16} color="rgba(138,109,44,.8)" className="memorial-band" />
              <h2 className="panel-title memorial-title">奏疏</h2>
              <CuancaoBand height={16} color="rgba(138,109,44,.8)" className="memorial-band" />
              <Baoxiang size={34} />
            </header>
            <div className="memorial-meta t-title">
              {view.calendar_label} · 中书门下进呈 · 凡{items.length}件
            </div>
            {items.length === 0 ? (
              <div className="memorial-empty" data-testid="memorial.empty">
                <p className="t-title">本季奏疏已尽阅。</p>
                <p className="muted">诸事或已采入诏书，或留待有司。可召对群臣，或径行推演。</p>
              </div>
            ) : (
              <div className="memorial-layout">
                <ol className="memorial-list">
                  {items.map((m, i) => {
                    const adopted = adoptedFor(m.id);
                    return (
                      <li key={m.id}>
                        <button className={cls('memorial-tab', item?.id === m.id && 'is-on', adopted && 'is-adopted')} data-testid={`memorial.item.${m.id}`} disabled={item?.id === m.id} onClick={() => setSel(m.id)}>
                          <EventArt ids={[m.illustration, `event.${m.id}`]} seed={`${m.id}${m.title}`} round className="memorial-roundel" />
                          <span className="memorial-tab-text">
                            <span className="memorial-tab-num t-title">其{['一', '二', '三', '四', '五', '六', '七', '八'][i] ?? i + 1}</span>
                            <span className="memorial-tab-title t-title">{m.title}</span>
                            {m.arrival && (
                              <span className={cls('memorial-tab-arrival', m.arrived_late && 'is-late')} data-testid={`memorial.arrival.${m.id}`}>
                                {m.arrived_late ? lateLabel(m.origin_turn, view.state.turn) : m.arrival}
                              </span>
                            )}
                            {adopted && <span className="memorial-tab-adopted">已采：{adopted.label}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <AnimatePresence mode="wait">
                  {item && (
                    <motion.article key={item.id} className="memorial-detail" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.25 }}>
                      <h3 className="memorial-detail-title t-title">{item.title}</h3>
                      {(item.arrival || (item.region && view.state.regions[item.region])) && (
                        <div className="memorial-region" data-testid="memorial.dateline">
                          {item.region && view.state.regions[item.region] && <span>事涉　{view.state.regions[item.region].name}</span>}
                          {item.arrival && <span className="memorial-dateline">{item.arrival}</span>}
                          {item.arrived_late && (
                            <span className="memorial-late" title={`${item.region_name ?? ''}驿程约 ${item.courier_days ?? '?'} 日，远地之报晚一季方到`}>
                              {lateLabel(item.origin_turn, view.state.turn)}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="memorial-summary selectable">{item.summary}</p>
                      <div className="section-label">廷臣之议</div>
                      <ul className="advisor-list">
                        {item.advisors.map((a, i) => {
                          const st = STANCE[a.stance] ?? STANCE.neutral;
                          return (
                            <li key={i} className="advisor">
                              <Portrait id={a.character} className="portrait--chip" />
                              <div className="advisor-body">
                                <div className="advisor-name">
                                  <b className="t-title">{chars[a.character]?.name ?? a.character}</b>
                                  <span className={cls('stance', st.cls)}>
                                    <i className="t-title">{st.glyph}</i>
                                    {st.name}
                                  </span>
                                </div>
                                <p className="advisor-line selectable">「{a.line}」</p>
                              </div>
                              <button
                                className="btn btn-outline btn-small advisor-save"
                                data-testid={`memorial.saveAdvice.${item.id}.${i}`}
                                onClick={() => g.saveAdvice(a.character, a.line, `memorial:${item.id}`)}
                                title="存入谏言库"
                              >
                                存谏
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="section-label">朱批</div>
                      <div className="memorial-options">
                        {item.options.map((o) => {
                          const on = adoptedFor(item.id)?.option_id === o.id;
                          return (
                            <div key={o.id} className={cls('memorial-option', on && 'is-on')}>
                              <button className="memorial-option-btn" data-testid={`memorial.option.${item.id}.${o.id}`} onClick={() => (on ? g.unadopt(item.id) : g.adopt(item, o.id))}>
                                <span className="memorial-option-seal t-title">{on ? '准' : '批'}</span>
                                <span className="memorial-option-text">
                                  <b className="t-title">{o.label}</b>
                                  {o.hint && <small>{o.hint}</small>}
                                </span>
                                <span className="memorial-option-act t-title">{on ? '已采入诏书 · 撤回' : '采入诏书'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </motion.article>
                  )}
                </AnimatePresence>
              </div>
            )}
            <footer className="memorial-actions">
              <button className="btn btn-ink btn-ink--red" data-testid="memorial.summon" onClick={() => g.openPanel('audience')}>
                召见群臣
              </button>
              <button className="btn btn-ink" data-testid="memorial.toEdict" onClick={() => g.openPanel('edict')}>
                拟诏{g.draft.adopted.length ? `（${g.draft.adopted.length}）` : ''}
              </button>
              {view.command_table && (
                <button className="btn btn-outline" data-testid="memorial.command" onClick={() => g.openPanel('command')}>
                  官职兵权{view.command_table.alerts?.length ? `·${view.command_table.alerts.length}` : ''}
                </button>
              )}
              <button className="btn btn-outline" data-testid="memorial.done" onClick={g.closePanel}>
                朕已阅
              </button>
            </footer>
          </Paper>
          <CuancaoColumn width={24} color="rgba(201,162,75,.9)" bg="#2b4b5e" className="hanging-border" />
        </div>
        <Roller orientation="horizontal" thickness={28} />
      </div>
    </PanelShell>
  );
}
