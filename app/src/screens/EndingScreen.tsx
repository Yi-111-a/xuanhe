import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAsset } from '../api/assets';
import { api } from '../api/client';
import type { HistoryEntry } from '../api/types';
import { InkScene } from '../components/EventArt';
import { Baoxiang, CuancaoBand } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { useToast } from '../components/Toast';
import { useGame } from '../store/game';
import { SCENARIO_META } from '../lib/names';

const OBJECTIVE_STATUS: Record<string, string> = { on_track: '守住', at_risk: '未达', failed: '已失', achieved: '达成', pending: '待定', ok: '守住', warn: '危', fail: '已失', done: '达成' };

export function EndingScreen() {
  const g = useGame();
  const toast = useToast();
  const outcome = g.view?.outcome;
  const [art] = useAsset(outcome ? [...(SCENARIO_META.endings[outcome.id] ? [SCENARIO_META.endings[outcome.id]] : []), `ending.${outcome.id}`, `ending.${outcome.id.replace(/^(e\d)_.*/i, '$1').toLowerCase()}`, 'ending.default'] : null);
  const [chronicle, setChronicle] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!g.sessionId) return;
    api
      .history(g.sessionId)
      .then(setChronicle)
      .catch((err) => toast.error(err, '史册未开'));
  }, [g.sessionId, toast]);

  if (!outcome) {
    return (
      <div className="ending" data-screen="ending" data-testid="ending.root">
        <div className="ending-empty t-title">史册未合。</div>
        <button className="btn btn-ink" data-testid="ending.toTitle" onClick={g.exitToTitle}>
          返回
        </button>
      </div>
    );
  }
  const fail = outcome.kind === 'fail';
  const review = g.view?.review ?? null;
  const byTurn = chronicle.filter((e) => e.type !== 'message');

  return (
    <div className={`ending ${fail ? 'ending--fail' : ''}`} data-screen="ending" data-testid="ending.root">
      <div className="ending-bg" aria-hidden="true">
        {art ? <img src={art} alt="" /> : <InkScene seed={`ending-${outcome.id}-${fail ? 'war' : 'court'}`} />}
      </div>
      <div className="ending-shade" aria-hidden="true" />
      <motion.div className="ending-card-wrap" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.22, 0.8, 0.24, 1] }}>
        <Paper variant="silk" seed={1919} className="ending-card">
          <CuancaoBand height={16} color="rgba(138,109,44,.85)" />
          <div className="ending-inner">
            <div className="ending-kind t-title">{fail ? '败局' : '终局'}</div>
            <h1 className="ending-title t-title" data-testid="ending.title">
              {outcome.title}
            </h1>
            <div className="ending-turn">{g.view?.calendar_label}</div>
            <Baoxiang size={40} />
            <p className="ending-text selectable" data-testid="ending.epilogue">
              {outcome.text}
            </p>
          </div>
          <CuancaoBand height={16} color="rgba(138,109,44,.85)" />
        </Paper>
      </motion.div>
      <motion.aside className="ending-chronicle" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 1 }}>
        <Paper variant="paper" seed={77} className="chronicle-paper">
          <div className="chronicle-title t-title">{review ? '复盘' : '本纪'}</div>
          <div className="chronicle-scroll">
          {review && (
            <section className="review" data-testid="ending.review">
              <p className="review-summary">
                {fail ? '败局' : '终局'}于{g.view?.calendar_label}，共历 <b className="t-num">{review.turns_played}</b> 季。
              </p>
              {review.satisfied.length > 0 && (
                <>
                  <div className="section-label">判定</div>
                  <ul className="review-list">
                    {review.satisfied.map((line, i) => (
                      <li key={i}>{line.replace(/^T\d+\s*时/, '')}</li>
                    ))}
                  </ul>
                </>
              )}
              {review.objectives.length > 0 && (
                <>
                  <div className="section-label">目标</div>
                  <ul className="review-objectives">
                    {review.objectives.map((o) => (
                      <li key={o.id} className={`obj--${o.status}`}>
                        <span>{o.title}</span>
                        <b className="t-title">{OBJECTIVE_STATUS[o.status] ?? o.status}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {review.stats.length > 0 && (
                <>
                  <div className="section-label">关键数值</div>
                  <ul className="review-stats">
                    {review.stats.map((x) => (
                      <li key={x.id}>{x.display}</li>
                    ))}
                  </ul>
                </>
              )}
              {review.highlights.length > 0 && (
                <>
                  <div className="section-label">要事</div>
                  <ul className="review-list">
                    {review.highlights.map((line, i) => (
                      <li key={i}>{line.replace(/^T\d+\s*/, '')}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="section-label">本纪</div>
            </section>
          )}
          <ol className="chronicle-list" data-testid="ending.chronicle">
            {byTurn.length === 0 && <li className="muted">史官尚未落笔。</li>}
            {byTurn.map((e) => (
              <li key={e.id} className={`chronicle-${e.type}`}>
                <span className="chronicle-glyph t-title">{{ start: '始', edict: '诏', choice: '择', turn: '季' }[e.type] ?? '记'}</span>
                <span>{e.label}</span>
              </li>
            ))}
          </ol>
          </div>
        </Paper>
      </motion.aside>
      <div className="ending-actions">
        <button className="btn btn-outline btn-outline--dark" data-testid="ending.timeline" onClick={() => g.openPanel('timeline')}>
          回溯史册
        </button>
        <button className="btn btn-ink btn-ink--red" data-testid="ending.newGame" onClick={() => g.setScreen('newgame')}>
          再开新局
        </button>
        <button className="btn btn-ink" data-testid="ending.toTitle" onClick={g.exitToTitle}>
          返回标题
        </button>
      </div>
    </div>
  );
}
