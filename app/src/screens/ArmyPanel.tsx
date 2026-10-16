// 兵部 · 军务 (CONTRACT §7.5): our armies with strength, quality, commander and whereabouts; the
// selected army's routes are drawn on the map (ETA per region from GET /armies). Orders are not
// executed here: each one becomes a policy card (or a posture op) in this season's edict draft.
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { ArmyInfo, PolicyCard } from '../api/types';
import { Paper } from '../components/Paper';
import { Portrait } from '../components/Portrait';
import { useToast } from '../components/Toast';
import { useGame, type DraftCard, type DraftOp } from '../store/game';
import { qualityWord, riskClass } from '../lib/court';
import { cls, fmtWan } from '../lib/util';

type Order = 'march' | 'garrison' | 'detach' | 'relieve' | 'commander';
const ORDERS: { id: Order; card: string; name: string; hint: string }[] = [
  { id: 'march', card: 'mil_march', name: '出征', hint: '开赴某地，以进攻之态接战' },
  { id: 'garrison', card: 'mil_garrison', name: '移师驻守', hint: '移驻某地，到后据守不出' },
  { id: 'detach', card: 'mil_detach', name: '分兵', hint: '分出若干兵，另以一将统领' },
  { id: 'relieve', card: 'mil_relieve_capital', name: '回援京畿', hint: '急召回援京师，到后据守' },
  { id: 'commander', card: 'mil_commander', name: '换帅', hint: '以某人统此军，原帅罢统' },
];
const POSTURES: { id: 'hold' | 'attack' | 'scorch'; name: string; card?: string; hint: string }[] = [
  { id: 'hold', name: '坚守', card: 'mil_hold', hint: '就地固守：守方战力 +20%，不追击' },
  { id: 'attack', name: '进击', hint: '取进击之势：攻方战力 +10%，败则多损' },
  { id: 'scorch', name: '坚壁清野', card: 'mil_scorch', hint: '尽收粮草入城：本地粮产繁荣下降，来犯之敌补给受损' },
];

const paramOf = (card: PolicyCard | undefined, kind: string) => card?.params.find((p) => p.kind === kind);

export function ArmyPanel() {
  const g = useGame();
  const toast = useToast();
  const view = g.view!;
  const state = view.state;
  const armies = g.aux.armies?.armies ?? null;
  const cards = g.aux.cards ?? null;
  const [order, setOrder] = useState<Order | null>(null);
  const [strength, setStrength] = useState(5000);
  const [commander, setCommander] = useState('');

  useEffect(() => {
    void g.loadArmies();
    void g.loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.seasonKey, g.aux.key]);

  const selected = armies?.find((a) => a.id === g.armyFocus.army) ?? null;
  useEffect(() => {
    if (armies?.length && !selected) g.setArmyFocus({ army: armies[0].id, target: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armies, selected]);
  useEffect(() => {
    setOrder(null);
    setCommander('');
  }, [selected?.id]);

  const cardById = useMemo(() => Object.fromEntries((cards ?? []).map((c) => [c.id, c])), [cards]);
  const faction = String((state.rules?.player_faction as string) ?? 'tang');
  const enemies = useMemo(
    () =>
      Object.values(state.armies ?? {})
        .filter((a) => a.strength > 0 && (a.faction ?? faction) !== faction)
        .sort((a, b) => b.strength - a.strength),
    [state.armies, faction],
  );
  const total = (armies ?? []).reduce((t, a) => t + a.strength, 0);

  /** draft entries (cards / posture ops) that concern this army */
  const draftFor = (a: ArmyInfo): (DraftCard | DraftOp)[] => [
    ...g.draft.cards.filter((c) => Object.values(c.params).includes(a.id) && cardById[c.card_id]?.category === '军务'),
    ...g.draft.ops.filter((o) => o.op.army === a.id),
  ];

  /** Why an order cannot be given to this army now (null = it can). */
  const blocked = (a: ArmyInfo, cardId: string | undefined, op?: string): string | null => {
    if (op) return a.orders.includes(op) ? null : a.in_transit ? '此军在途，只能改军态或换帅' : '此军不能下此令';
    const card = cardId ? cardById[cardId] : undefined;
    if (!card) return cards ? '本剧本无此军令' : '政令卡尚未取到';
    if (!card.available) return card.unavailable_reason || '此令暂不可下';
    const ap = paramOf(card, 'army');
    if (ap && !ap.options?.some((o) => o.id === a.id)) return a.in_transit ? '此军在途，不能再调' : '此军不合此令（兵力不足或另有所属）';
    if (card.cooldown && g.draft.cards.some((c) => c.card_id === card.id)) return '有冷却的政令卡，一道诏书只能用一次';
    return null;
  };

  const current = order ? ORDERS.find((o) => o.id === order)! : null;
  const currentCard = current ? cardById[current.card] : undefined;
  const regionParam = paramOf(currentCard, 'region');
  const charParam = paramOf(currentCard, 'character');
  const amountParam = paramOf(currentCard, 'amount');
  const destinations = useMemo(() => {
    if (!selected || !regionParam?.options) return [];
    return regionParam.options
      .filter((o) => o.id !== selected.region)
      .map((o) => ({ ...o, eta: selected.etas[o.id] ?? null }))
      .sort((x, y) => (x.eta ?? 99) - (y.eta ?? 99));
  }, [selected, regionParam]);
  const target = g.armyFocus.target && destinations.some((d) => d.id === g.armyFocus.target && d.eta != null) ? g.armyFocus.target : '';
  const maxStrength = selected ? Math.max(1000, Math.min(amountParam?.max ?? selected.strength, selected.strength - 1000)) : 1000;
  const minStrength = Math.min(amountParam?.min ?? 1000, maxStrength);
  const missing = current
    ? [regionParam && !target ? '目的地' : null, charParam && !commander ? '统将' : null].filter(Boolean)
    : [];

  const armyName = (a: ArmyInfo) => a.name;
  const addOrder = () => {
    if (!selected || !current || !currentCard) return;
    const params: Record<string, string | number> = {};
    for (const p of currentCard.params) {
      if (p.kind === 'army') params[p.name] = selected.id;
      else if (p.kind === 'region') params[p.name] = target;
      else if (p.kind === 'character') params[p.name] = commander;
      else if (p.kind === 'amount') params[p.name] = Math.round(Math.max(minStrength, Math.min(maxStrength, strength)));
    }
    g.addCard(currentCard.id, params, 'army');
    const where = target ? `→${state.regions[target]?.name ?? ''}` : '';
    toast.success(`已列入诏书：${current.name}·${armyName(selected)}${where}。颁布之后方才施行。`, '兵部');
    setOrder(null);
    g.setArmyFocus({ target: null });
  };
  const addPosture = (p: (typeof POSTURES)[number]) => {
    if (!selected) return;
    if (p.card) g.addCard(p.card, Object.fromEntries((cardById[p.card]?.params ?? []).filter((x) => x.kind === 'army').map((x) => [x.name, selected.id])), 'army');
    else g.addOp({ op: 'set_army_posture', army: selected.id, posture: p.id }, `${armyName(selected)}改取${p.name}之势`);
    toast.success(`已列入诏书：${armyName(selected)}改取${p.name}之势。颁布之后方才施行。`, '兵部');
  };

  const commanderLine = (a: ArmyInfo) => {
    if (!a.commander) return { tag: '无帅', cls: 'is-acting', text: '无统帅，副将暂摄' };
    const ch = state.characters[a.commander.id];
    const toArmy = (ch?.in_transit as { to_region?: string } | null | undefined)?.to_region === a.region;
    if (a.commander.present) return { tag: '在营', cls: 'is-present', text: a.commander.name };
    if (toArmy) return { tag: '赴任', cls: 'is-enroute', text: `${a.commander.name}（在途赴任）` };
    return { tag: '遥领', cls: 'is-remote', text: `${a.commander.name}（今在${state.regions[ch?.region ?? '']?.name ?? '他处'}）` };
  };

  const draftCount = g.draft.cards.filter((c) => c.origin === 'army' || cardById[c.card_id]?.category === '军务').length + g.draft.ops.length;

  return (
    <motion.aside
      className="army-drawer"
      data-screen="army"
      data-testid="army.root"
      data-hud="army"
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: [0.22, 0.8, 0.24, 1] }}
    >
      <Paper variant="paper" seed={751} amp={2} className="army-paper">
        <header className="army-head">
          <span className="army-head-seal t-title" aria-hidden="true">
            兵
          </span>
          <div>
            <h2 className="panel-title army-title">兵部 · 军务</h2>
            <div className="army-sub">
              本朝诸军 <b className="t-num">{armies?.length ?? '…'}</b> 支 · 共 <b className="t-num">{armies ? fmtWan(total) : '…'}</b>
            </div>
          </div>
          <button className="close-btn" data-testid="army.close" onClick={g.closePanel} aria-label="收起兵部">
            ×
          </button>
        </header>
        <p className="army-intro">军令不当场施行：列入诏书，颁布后由兵部发符；远镇驿程遥远者，令达于下季。</p>

        <div className="army-body">
          {!armies ? (
            <div className="ink-loader">
              <i />
              <i />
              <i /> 检阅兵籍
            </div>
          ) : (
            <ul className="army-list" aria-label="本朝诸军">
              {armies.map((a) => {
                const cl = commanderLine(a);
                const pending = draftFor(a).length;
                return (
                  <li key={a.id}>
                    <button
                      className={cls('army-item', a.id === selected?.id && 'is-on')}
                      data-testid={`army.item.${a.id}`}
                      aria-pressed={a.id === selected?.id}
                      disabled={a.id === selected?.id}
                      onClick={() => g.setArmyFocus({ army: a.id, target: null })}
                    >
                      <span className="army-item-top">
                        <b className="t-title">{a.name}</b>
                        <span className="army-strength t-num">{fmtWan(a.strength)}</span>
                        {a.quality != null && <span className="army-quality">{qualityWord(a.quality)}</span>}
                        {pending > 0 && <span className="army-pending">已拟 {pending}</span>}
                      </span>
                      <span className="army-item-line">
                        <span className={cls('cmd-tag', cl.cls)}>{cl.tag}</span>
                        <span>{cl.text}</span>
                      </span>
                      <span className="army-item-line army-item-where">
                        <span>{a.whereabouts ?? a.region_name}</span>
                        <span className="posture-tag">{a.posture_label ?? '常态'}</span>
                        {a.autonomy_risk && (
                          <span className={cls('risk-tag', riskClass(a.autonomy_risk))} title="出征之令被延宕、擅改的风险（据统帅忠诚、野心、轻躁）">
                            自主风险 {a.autonomy_risk}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected && (
            <section className="army-detail" data-testid="army.detail">
              <div className="army-detail-head">
                {selected.commander ? <Portrait id={selected.commander.id} className="portrait--chip" /> : <span className="army-nobody t-title">副</span>}
                <div>
                  <b className="t-title">{selected.name}</b>
                  <small>{selected.commander?.note ?? '无统帅，副将暂摄'}</small>
                </div>
              </div>

              <div className="section-label">军令</div>
              <div className="army-orders">
                {ORDERS.map((o) => {
                  const why = blocked(selected, o.card);
                  return (
                    <button
                      key={o.id}
                      className={cls('army-order', order === o.id && 'is-on')}
                      data-testid={`army.order.${o.id}`}
                      disabled={Boolean(why)}
                      title={why ?? `${o.name}：${o.hint}`}
                      aria-pressed={order === o.id}
                      onClick={() => {
                        setOrder(order === o.id ? null : o.id);
                        if (o.id === 'detach') setStrength(Math.round(Math.min(maxStrength, Math.max(minStrength, selected.strength / 4)) / 1000) * 1000);
                      }}
                    >
                      <b className="t-title">{o.name}</b>
                      <small>{why ?? o.hint}</small>
                    </button>
                  );
                })}
              </div>

              {current && currentCard && (
                <div className="army-form" data-testid="army.form">
                  {regionParam && (
                    <label className="army-field">
                      <span>目的地</span>
                      <select className="field" data-testid="army.target" value={target} onChange={(e) => g.setArmyFocus({ target: e.target.value || null })}>
                        <option value="">— 择地（亦可在图上点选）—</option>
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id} disabled={d.eta == null}>
                            {d.name}
                            {d.eta == null ? '（无路可达）' : ` · 约${d.eta}季`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {amountParam && (
                    <label className="army-field">
                      <span>
                        分兵 <b className="t-num">{Math.round(Math.min(maxStrength, Math.max(minStrength, strength))).toLocaleString('zh-CN')}</b>
                      </span>
                      <input
                        type="range"
                        className="army-range"
                        data-testid="army.strength"
                        min={minStrength}
                        max={maxStrength}
                        step={1000}
                        value={Math.min(maxStrength, Math.max(minStrength, strength))}
                        onChange={(e) => setStrength(Number(e.target.value))}
                        aria-label="分兵数"
                      />
                    </label>
                  )}
                  {charParam && (
                    <label className="army-field">
                      <span>{current.id === 'detach' ? '统将' : '新帅'}</span>
                      <select className="field" data-testid="army.commander" value={commander} onChange={(e) => setCommander(e.target.value)}>
                        <option value="">— 择人 —</option>
                        {(charParam.options ?? [])
                          .filter((o) => o.id !== selected.commander?.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                              {o.note ? `（${o.note}）` : ''}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <p className="army-cost">{currentCard.cost_hint}</p>
                  <div className="army-form-actions">
                    <button className="btn btn-ink btn-small" data-testid="army.addOrder" disabled={missing.length > 0} title={missing.length ? `尚缺：${missing.join('、')}` : '列入本季诏书草案（颁布后施行）'} onClick={addOrder}>
                      列入诏书
                    </button>
                    <button className="btn btn-outline btn-small" data-testid="army.cancelOrder" onClick={() => setOrder(null)}>
                      作罢
                    </button>
                  </div>
                </div>
              )}

              <div className="section-label">军态</div>
              <div className="army-postures">
                {POSTURES.map((p) => {
                  const why = p.card ? blocked(selected, p.card) : blocked(selected, undefined, 'set_army_posture');
                  const same = selected.posture === p.id;
                  return (
                    <button
                      key={p.id}
                      className={cls('posture-btn', same && 'is-current')}
                      data-testid={`army.posture.${p.id}`}
                      disabled={Boolean(why) || same}
                      title={same ? `此军已取${p.name}之势` : why ?? p.hint}
                      onClick={() => addPosture(p)}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {draftFor(selected).length > 0 && (
                <div className="army-drafted">
                  <div className="section-label">已列入诏书（未颁布）</div>
                  {draftFor(selected).map((d) => {
                    const isCard = 'card_id' in d;
                    const label = isCard ? draftLabel(d, cardById[d.card_id], state.regions) : d.label;
                    return (
                      <span key={d.uid} className="army-drafted-chip">
                        {label}
                        <button data-testid={`army.draft.${d.uid}.remove`} aria-label={`撤回${label}`} onClick={() => (isCard ? g.removeCard(d.uid) : g.removeOp(d.uid))}>
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="army-enemy" data-testid="army.enemy">
            <div className="section-label">
              敌情 · 风闻<small className="muted">　斥候所报，未必确实</small>
            </div>
            {enemies.length === 0 ? (
              <p className="muted">诸边暂无敌军之报。</p>
            ) : (
              <ul>
                {enemies.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <b className="t-title">{a.name}</b>
                    <span>{state.factions?.[a.faction ?? '']?.name ?? ''}</span>
                    <span>{a.in_transit ? '行军中' : `在${state.regions[a.region]?.name ?? '域外'}`}</span>
                    <span className="t-num">风闻约 {fmtWan(Math.round(a.strength / 5000) * 5000)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="army-foot">
          <span>
            本季诏书已拟军令 <b className="t-num">{draftCount}</b> 道
          </span>
          <button className="btn btn-ink btn-small" data-testid="army.toEdict" onClick={() => g.openPanel('edict')}>
            往诏书
          </button>
        </footer>
      </Paper>
    </motion.aside>
  );
}

function draftLabel(d: DraftCard, card: PolicyCard | undefined, regions: Record<string, { name: string }>): string {
  if (!card) return d.card_id;
  const to = card.params.find((p) => p.kind === 'region');
  const who = card.params.find((p) => p.kind === 'character');
  const amount = card.params.find((p) => p.kind === 'amount');
  const parts = [
    to && d.params[to.name] ? `→${regions[String(d.params[to.name])]?.name ?? ''}` : '',
    amount && d.params[amount.name] ? ` ${Number(d.params[amount.name]).toLocaleString('zh-CN')}人` : '',
    who && d.params[who.name] ? `（${who.options?.find((o) => o.id === d.params[who.name])?.name ?? ''}）` : '',
  ];
  return `${card.title}${parts.join('')}`;
}
