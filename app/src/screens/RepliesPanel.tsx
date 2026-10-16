// 回奏 (CONTRACT §7.1): answers to last season's 遣使问对 / 书面奏对, delivered by the courier with
// this season's settlement; and the 书面议状 that arrived with them (§7.2).
import { useEffect } from 'react';
import { Baoxiang } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';
import { markRepliesRead } from '../lib/court';
import { humanize } from '../lib/names';

export function RepliesPanel() {
  const g = useGame();
  const view = g.view!;
  const replies = view.replies ?? [];
  const opinions = view.written_opinions ?? [];
  const chars = view.state.characters;
  useEffect(() => {
    markRepliesRead(g.seasonKey, replies.length);
  }, [g.seasonKey, replies.length]);

  return (
    <PanelShell screen="replies" onClose={g.closePanel}>
      <Paper variant="paper" seed={318} className="replies-paper">
        <header className="timeline-head">
          <Baoxiang size={28} />
          <h2 className="panel-title">回奏</h2>
          <Baoxiang size={28} />
        </header>
        <p className="muted replies-intro">不在京之臣，遣使问对或书面奏对，其回奏随驿递于下季送到。{view.calendar_label}所到如下。</p>
        <ul className="replies-list" data-testid="replies.list">
          {replies.length === 0 && (
            <li className="muted replies-none" data-testid="replies.empty">
              本季无回奏。召对时择不在京之臣（遣使问对），其回奏于下季送达。
            </li>
          )}
          {replies.map((r, i) => {
            const name = r.name ?? chars[r.character]?.name ?? '';
            const text = r.text ? humanize(r.text) : null;
            return (
              <li key={`${r.character}-${i}`} className="reply-item" data-testid={`replies.item.${i}`}>
                <Portrait id={r.character} className="portrait--card reply-portrait" />
                <div className="reply-body">
                  <div className="reply-meta">
                    <b className="t-title">{name}</b>
                    {r.mode_label && <span className="reply-mode">{r.mode_label}</span>}
                    {r.asked_turn != null && <span className="muted">上季所问</span>}
                  </div>
                  {r.question && <p className="reply-question">问：「{r.question}」</p>}
                  {text ? (
                    <p className="reply-text selectable">{text}</p>
                  ) : (
                    <p className="reply-text muted">{r.roleplay ? '此回奏由接入的外部模型代为作答（见简报「回奏」一节）。' : '回奏未至。'}</p>
                  )}
                </div>
                {text && (
                  <button className="btn btn-outline btn-small" data-testid={`replies.save.${i}`} onClick={() => g.saveAdvice(r.character, text, 'reply')}>
                    存谏
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {opinions.length > 0 && (
          <section className="replies-opinions" data-testid="replies.opinions">
            <div className="section-label">书面议状 · 本季送到（已入谏言库）</div>
            <ul className="replies-list">
              {opinions.map((o, i) => (
                <li key={o.id ?? i} className="reply-item reply-item--opinion">
                  <Portrait id={o.character} className="portrait--chip" />
                  <div className="reply-body">
                    <div className="reply-meta">
                      <b className="t-title">{chars[o.character]?.name ?? o.name ?? ''}</b>
                      <span className="reply-mode">书面议状</span>
                    </div>
                    <p className="reply-text selectable">{humanize(o.text)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <footer className="replies-actions">
          <button className="btn btn-outline" data-testid="replies.toAdvice" onClick={() => g.openPanel('advice')}>
            谏言库
          </button>
          <button className="btn btn-ink" data-testid="replies.toAudience" onClick={() => g.openPanel('audience')}>
            召对
          </button>
        </footer>
      </Paper>
    </PanelShell>
  );
}
