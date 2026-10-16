import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { HistoryEntry, SessionSummary } from '../api/types';
import { Baoxiang } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { useToast } from '../components/Toast';
import { useGame } from '../store/game';
import { cls } from '../lib/util';

const GLYPH: Record<string, string> = { start: '始', edict: '诏', choice: '择', turn: '季', op: '令', pending: '缓', rewind: '溯', message: '言' };
const SEASON = ['春', '夏', '秋', '冬'];
const CN = ['十', '十一', '十二', '十三', '十四', '十五', '十六'];
const turnLabel = (t: number) => `天宝${CN[Math.floor(t / 4)] ?? ''}载${SEASON[t % 4]}`;

export function TimelinePanel() {
  const g = useGame();
  const toast = useToast();
  const [history, setHistory] = useState<(HistoryEntry & { head?: boolean })[] | null>(null);
  const [saves, setSaves] = useState<SessionSummary[] | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [tab, setTab] = useState<'history' | 'saves'>(g.sessionId ? 'history' : 'saves');

  const load = useCallback(async () => {
    try {
      setSaves(await api.sessions());
    } catch (err) {
      toast.error(err, '存档未开');
      setSaves([]);
    }
    if (g.sessionId) {
      try {
        setHistory(await api.history(g.sessionId));
      } catch (err) {
        toast.error(err, '史册未开');
        setHistory([]);
      }
    }
  }, [g.sessionId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => (history ?? []).filter((e) => e.type !== 'message' && e.type !== 'op'), [history]);
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const e of visible) m.set(e.parentId, (m.get(e.parentId) ?? 0) + 1);
    return m;
  }, [visible]);
  const headId = visible.find((e) => e.head)?.id ?? visible[visible.length - 1]?.id;
  const groups = useMemo(() => {
    const out = new Map<number, typeof visible>();
    for (const e of visible) out.set(e.turn, [...(out.get(e.turn) ?? []), e]);
    return [...out.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const del = async (id: string) => {
    try {
      await api.deleteSession(id);
      toast.success('存档已焚毁。', '删档');
      setArmed(null);
      if (id === g.sessionId) g.exitToTitle();
      await load();
    } catch (err) {
      toast.error(err, '删档未成');
    }
  };

  const [exporting, setExporting] = useState(false);
  const exportLog = async () => {
    if (!g.sessionId) return;
    setExporting(true);
    try {
      const log = await api.exportLog(g.sessionId);
      const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `天宝史册-${g.view?.calendar_label ?? g.sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success('史册已导出为 JSON。', '导出');
    } catch (err) {
      toast.error(err, '导出未成');
    } finally {
      setExporting(false);
    }
  };

  return (
    <PanelShell screen="timeline" onClose={g.closePanel}>
      <Paper variant="paper" seed={333} className="timeline-paper">
        <header className="timeline-head">
          <Baoxiang size={30} />
          <h2 className="panel-title">史册</h2>
          <Baoxiang size={30} />
        </header>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'history'} className={cls('tab t-title', tab === 'history' && 'is-on')} data-testid="timeline.tab.history" disabled={!g.sessionId || tab === 'history'} onClick={() => setTab('history')}>
            本局时间线
          </button>
          <button role="tab" aria-selected={tab === 'saves'} className={cls('tab t-title', tab === 'saves' && 'is-on')} data-testid="timeline.tab.saves" disabled={tab === 'saves'} onClick={() => setTab('saves')}>
            存档
          </button>
          {g.sessionId && (
            <button className="btn btn-outline btn-small timeline-export" data-testid="timeline.export" disabled={exporting} onClick={exportLog} title="导出本局结构化复盘日志（JSON）">
              {exporting ? '导出中…' : '导出史册'}
            </button>
          )}
        </div>

        {tab === 'history' && (
          <div className="timeline-body" data-testid="timeline.history">
            {!history && (
              <div className="ink-loader">
                <i />
                <i />
                <i /> 翻检史册
              </div>
            )}
            {history && groups.length === 0 && <p className="muted">史官尚未落笔。</p>}
            {groups.map(([turn, entries]) => (
              <section key={turn} className="tl-group">
                <div className="tl-turn t-title">{turnLabel(turn)}</div>
                <ol>
                  {entries.map((e) => (
                    <li key={e.id} className={cls('tl-entry', `tl-${e.type}`, e.id === headId && 'is-head', (childrenOf.get(e.parentId) ?? 0) > 1 && 'is-branch')}>
                      <span className="tl-glyph t-title">{GLYPH[e.type] ?? '记'}</span>
                      <span className="tl-label">
                        {e.label}
                        {e.id === headId && <em className="tl-now">今</em>}
                        {(childrenOf.get(e.parentId) ?? 0) > 1 && <em className="tl-fork">岔</em>}
                      </span>
                      {e.id !== headId &&
                        (armed === e.id ? (
                          <span className="tl-confirm">
                            <button className="btn btn-ink btn-ink--red btn-small" data-testid={`timeline.rewindConfirm.${e.id}`} disabled={g.busy.rewind} onClick={() => g.rewind(e.id)}>
                              确认回溯
                            </button>
                            <button className="btn btn-outline btn-small" data-testid={`timeline.rewindCancel.${e.id}`} onClick={() => setArmed(null)}>
                              罢
                            </button>
                          </span>
                        ) : (
                          <button className="btn btn-outline btn-small" data-testid={`timeline.rewind.${e.id}`} onClick={() => setArmed(e.id)}>
                            回溯至此
                          </button>
                        ))}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        {tab === 'saves' && (
          <div className="timeline-body" data-testid="timeline.saves">
            {!saves && (
              <div className="ink-loader">
                <i />
                <i />
                <i /> 检点存档
              </div>
            )}
            {saves && saves.length === 0 && <p className="muted">尚无存档。开始新局后自动存档。</p>}
            <ul className="save-list">
              {(saves ?? []).map((s) => (
                <li key={s.id} className={cls('save', s.id === g.sessionId && 'is-current')}>
                  <span className="save-seal t-title">{s.id === g.sessionId ? '今' : '档'}</span>
                  <span className="save-text">
                    <b className="t-title">{s.label ?? turnLabel(s.turn)}</b>
                    <small className="t-num">
                      第 {s.turn + 1} 季{s.updated ? ` · ${new Date(s.updated).toLocaleString('zh-CN')}` : ''}
                    </small>
                  </span>
                  <button className="btn btn-ink btn-small" data-testid={`timeline.load.${s.id}`} onClick={() => g.loadSession(s.id)}>
                    读档
                  </button>
                  {armed === `del:${s.id}` ? (
                    <button className="btn btn-ink btn-ink--red btn-small" data-testid={`timeline.deleteConfirm.${s.id}`} onClick={() => del(s.id)}>
                      确认焚毁
                    </button>
                  ) : (
                    <button className="btn btn-outline btn-small" data-testid={`timeline.delete.${s.id}`} onClick={() => setArmed(`del:${s.id}`)}>
                      删档
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Paper>
    </PanelShell>
  );
}
