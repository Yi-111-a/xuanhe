import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAsset } from '../api/assets';
import { Baoxiang, CuancaoBand } from '../components/Ornaments';
import { Paper, Roller } from '../components/Paper';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';

const OBJECTIVES = [
  { t: '弭兵', d: '让「渔阳鼙鼓」不变红；若已起兵，守住潼关与长安。' },
  { t: '足食足兵', d: '国库与太仓粮储全程不枯竭。' },
  { t: '皇权在握', d: '终局时君威不低于五十，未内禅，未有马嵬之变。' },
];

const CAST = ['li_linfu', 'yang_guozhong', 'an_lushan', 'gao_lishi', 'yan_zhenqing', 'geshu_han'];
const CAST_NAMES: Record<string, string> = {
  li_linfu: '李林甫',
  yang_guozhong: '杨国忠',
  an_lushan: '安禄山',
  gao_lishi: '高力士',
  yan_zhenqing: '颜真卿',
  geshu_han: '哥舒翰',
};

export function NewGameScreen() {
  const g = useGame();
  const [seed, setSeed] = useState(() => 751);
  const [bg] = useAsset(['ui.desk']);
  const scenario = g.scenario;
  return (
    <div className="newgame" data-screen="newgame" data-testid="newgame.root" style={bg ? { backgroundImage: `linear-gradient(rgba(20,12,8,.72),rgba(20,12,8,.72)),url(${bg})` } : undefined}>
      <motion.div className="newgame-scroll" initial={{ clipPath: 'inset(0 48% 0 48%)' }} animate={{ clipPath: 'inset(0 0% 0 0%)' }} transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}>
        <Roller orientation="vertical" length="100%" thickness={30} />
        <Paper variant="silk" seed={751} className="newgame-paper" sides="tb">
          <CuancaoBand height={20} color="rgba(138,109,44,.8)" />
          <div className="newgame-inner">
            <header className="newgame-head">
              <Baoxiang size={44} />
              <div>
                <h2 className="panel-title newgame-title">{scenario?.title ?? '天宝十载'}</h2>
                <p className="newgame-era t-title">{scenario?.era ?? '盛唐'} · 一季一回合 · 标准局二十季</p>
              </div>
              <Baoxiang size={44} />
            </header>
            <p className="newgame-hook selectable">
              {scenario?.summary ?? '盛世只剩最后四年。你是唐玄宗，你能阻止安史之乱吗？'}
              群臣由大模型扮演，国库、兵马、人心由确定性引擎结算；每一道诏令都有执行回执。
            </p>
            <div className="newgame-cols">
              <section>
                <div className="section-label">三大目标</div>
                <ol className="newgame-objectives">
                  {OBJECTIVES.map((o, i) => (
                    <li key={o.t}>
                      <span className="objective-num t-title">{['一', '二', '三'][i]}</span>
                      <b className="t-title">{o.t}</b>
                      <span>{o.d}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <div className="section-label">满朝文武</div>
                <div className="newgame-cast">
                  {CAST.map((id) => (
                    <figure key={id}>
                      <Portrait id={id} className="portrait--chip" />
                      <figcaption className="t-title">{CAST_NAMES[id]}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            </div>
            <section className="newgame-situation">
              <div className="section-label">天下大势</div>
              <ul>
                <li>安禄山身兼平卢、范阳二镇，今又请兼河东，北边之兵几半天下。</li>
                <li>右相李林甫执政近二十年；杨国忠以度支得宠，与禄山相忌。</li>
                <li>南诏陷姚州，高仙芝献俘西域，四方边将皆欲立功。</li>
              </ul>
            </section>
            <div className="newgame-seed">
              <label htmlFor="seed" className="t-title">
                天命之数
              </label>
              <input
                id="seed"
                className="field t-num"
                data-testid="newgame.seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
              />
              <button className="btn btn-outline btn-small" data-testid="newgame.randomSeed" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>
                卜一数
              </button>
              <small className="muted">同一数字，同一天命：所有随机皆由此数推演。</small>
            </div>
          </div>
          <div className="newgame-actions">
              <button className="btn btn-outline" data-testid="newgame.back" onClick={() => g.setScreen('title')}>
                返回
              </button>
              <button className="btn btn-ink btn-ink--red newgame-start" data-testid="newgame.start" disabled={g.busy.start} onClick={() => g.startGame(seed)}>
                {g.busy.start ? '登基中…' : '御极临朝'}
              </button>
          </div>
          <CuancaoBand height={20} color="rgba(138,109,44,.8)" />
        </Paper>
        <Roller orientation="vertical" length="100%" thickness={30} />
      </motion.div>
    </div>
  );
}
