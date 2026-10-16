import { useEffect } from 'react';
import { Baoxiang } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';

const SOURCE: Record<string, string> = { audience: '召对', debate: '廷议', reply: '回奏', '书面议状': '书面议状' };
/** 「〔书面议状·自陇右驿递〕…」 → 「自陇右驿递」 */
const via = (text: string) => text.match(/^〔[^·〕]*·([^〕]+)〕/)?.[1] ?? null;

export function AdvicePanel() {
  const g = useGame();
  const chars = g.view?.state.characters ?? {};
  useEffect(() => {
    void g.loadAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cite = (character: string, text: string) => {
    const name = chars[character]?.name ?? '';
    const prev = g.draft.sections.other ?? '';
    g.setSection('other', `${prev}${prev && !/[。；\n]$/.test(prev) ? '。' : ''}援${name}之议：${text}`);
    g.openPanel('edict');
  };

  return (
    <PanelShell screen="advice" onClose={g.closePanel}>
      <Paper variant="paper" seed={202} className="advice-paper">
        <header className="timeline-head">
          <Baoxiang size={28} />
          <h2 className="panel-title">谏言库</h2>
          <Baoxiang size={28} />
        </header>
        <p className="muted advice-intro">召对、廷议、奏疏中臣下之言，择其要者录于此。拟诏时可援引，所援之言随诏文交有司解析。</p>
        <ul className="advice-list" data-testid="advice.list">
          {g.advice.length === 0 && <li className="muted advice-none">尚无谏言。于召对中选中臣下之语，即可存入。</li>}
          {g.advice.map((a, i) => (
            <li key={a.id ?? i} className="advice-item">
              {a.character && a.character !== 'xuanzong' ? <Portrait id={a.character} className="portrait--chip" /> : <span className="advice-imperial t-title">御</span>}
              <div className="advice-item-body">
                <div className="advice-item-meta">
                  <b className="t-title">{chars[a.character]?.name ?? a.name ?? (a.character === 'xuanzong' ? '御批' : a.character)}</b>
                  <span className={a.source === '书面议状' ? 'advice-source advice-source--written' : 'advice-source'} data-testid={`advice.source.${i}`}>
                    {SOURCE[a.source] ?? (a.source.startsWith('memorial') ? '奏疏' : a.source)}
                    {via(a.text) ? `·${via(a.text)}` : ''}
                  </span>
                  {a.turn != null && <span className="t-num">第 {a.turn + 1} 季</span>}
                  {a.source === '书面议状' && a.turn === g.view?.state.turn && <span className="advice-new">本季送到</span>}
                </div>
                <p className="selectable">「{a.text}」</p>
              </div>
              <button className="btn btn-outline btn-small" data-testid={`advice.cite.${i}`} onClick={() => cite(a.character, a.text)}>
                援引入诏
              </button>
            </li>
          ))}
        </ul>
      </Paper>
    </PanelShell>
  );
}
