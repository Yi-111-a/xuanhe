import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAsset } from '../api/assets';
import { Baoxiang, CuancaoBand } from '../components/Ornaments';
import { Paper, Roller } from '../components/Paper';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';

const OBJECTIVES = [
  { t: '北门锁钥', d: '让「胡马南牧」不到铁骑之数；金兵若已南下，守住汴京。' },
  { t: '府库不竭', d: '国库与粮储全程不枯竭。' },
  { t: '社稷安固', d: '终局时君威不低于五十，未内禅，东南不失于方腊。' },
];

const CAST = ['cai_jing', 'wang_fu', 'tong_guan', 'li_gang', 'zhong_shidao', 'zhao_liangsi'];
const CAST_NAMES: Record<string, string> = {
  cai_jing: '蔡京',
  wang_fu: '王黼',
  tong_guan: '童贯',
  li_gang: '李纲',
  zhong_shidao: '种师道',
  zhao_liangsi: '赵良嗣',
};

export function NewGameScreen() {
  const g = useGame();
  const [seed, setSeed] = useState(() => 1120);
  const [bg] = useAsset(['ui.desk']);
  const scenario = g.scenario;
  return (
    <div className="newgame" data-screen="newgame" data-testid="newgame.root" style={bg ? { backgroundImage: `linear-gradient(rgba(14,18,17,.72),rgba(14,18,17,.72)),url(${bg})` } : undefined}>
      <motion.div className="newgame-scroll" initial={{ clipPath: 'inset(0 48% 0 48%)' }} animate={{ clipPath: 'inset(0 0% 0 0%)' }} transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}>
        <Roller orientation="vertical" length="100%" thickness={30} />
        <Paper variant="silk" seed={1120} className="newgame-paper" sides="tb">
          <CuancaoBand height={20} color="rgba(125,110,72,.8)" />
          <div className="newgame-inner">
            <header className="newgame-head">
              <Baoxiang size={44} />
              <div>
                <h2 className="panel-title newgame-title">{scenario?.title ?? '宣和二年'}</h2>
                <p className="newgame-era t-title">{scenario?.era ?? '北宋'} · 一季一回合 · 标准局二十四季（金兵南下则加时一年）</p>
              </div>
              <Baoxiang size={44} />
            </header>
            <p className="newgame-hook selectable">
              {scenario?.summary ?? '繁华只剩最后六年。你是宋徽宗，你能避免靖康之耻吗？'}
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
                <li>女真阿骨打连破辽之东京、上京；赵良嗣请浮海使金，约夹攻辽、宋取燕京。</li>
                <li>太师蔡京总治三省，少宰王黼骤贵；童贯领枢密，梁师成掌御笔。</li>
                <li>朱勔主苏杭应奉局，花石纲扰东南二十年，两浙怨声日甚。</li>
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
          <CuancaoBand height={20} color="rgba(125,110,72,.8)" />
        </Paper>
        <Roller orientation="vertical" length="100%" thickness={30} />
      </motion.div>
    </div>
  );
}
