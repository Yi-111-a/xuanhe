// 诏书 (round 9, CONTRACT §7.4): three layers on one edict scroll —
//  壹 批答奏疏: the memorial options adopted in the 奏疏 book;
//  贰 政令: policy cards picked by category, each a clause with parameter pickers (options come
//     filtered from GET /policy_cards), plus army orders sent over from the 兵部;
//  叁 御笔: free text, folded away by default (offline it is only recorded, not executed).
// 预览 returns the 有司回执: per clause its source, status, delay kind and autonomy risk.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Clause, EdictReceipt, PolicyCard } from '../api/types';
import { Baoxiang } from '../components/Ornaments';
import { Paper, Roller } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { useToast } from '../components/Toast';
import { useGame, type DraftCard } from '../store/game';
import { delayKindLabel, riskClass, SOURCE_NAMES } from '../lib/court';
import { cls, opSummary } from '../lib/util';

const STATUS: Record<string, { glyph: string; name: string; cls: string }> = {
  applied: { glyph: '行', name: '施行', cls: 'st--applied' },
  delayed: { glyph: '缓', name: '迟滞', cls: 'st--delayed' },
  rejected: { glyph: '驳', name: '驳回', cls: 'st--rejected' },
  narrative_only: { glyph: '记', name: '载记', cls: 'st--narrative' },
  needs_clarification: { glyph: '疑', name: '待明', cls: 'st--unclear' },
};

export const CARD_CATEGORIES = ['军务', '内政', '人事', '外交', '财计'];
const CAT_GLYPH: Record<string, string> = { 军务: '兵', 内政: '政', 人事: '吏', 外交: '使', 财计: '财' };

/** Card parameters still to be filled (names as shown). */
function missingParams(d: DraftCard, card: PolicyCard | undefined): string[] {
  if (!card) return [];
  return card.params.filter((p) => d.params[p.name] === undefined || d.params[p.name] === '').map((p) => p.label ?? p.name);
}

export function EdictPanel() {
  const g = useGame();
  const toast = useToast();
  const view = g.view!;
  const [focus, setFocus] = useState<string>('other');
  const [polished, setPolished] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const hasText = Object.values(g.draft.sections).some((t) => t.trim());
  const [brushOpen, setBrushOpen] = useState(hasText);
  const [picker, setPicker] = useState(false);
  const receipt = g.receipt;
  const chars = view.state.characters;
  const offline = view.provider_mode === 'offline';
  const cards = g.aux.cards;
  const cardById = useMemo(() => Object.fromEntries((cards ?? []).map((c) => [c.id, c])), [cards]);
  const resName = (id: string) => view.state.resources[id]?.name ?? id;
  const hidden = (id: string) => Boolean(view.state.resources[id]?.hidden);
  const entName = (id: string) =>
    view.state.armies?.[id]?.name ?? view.state.regions[id]?.name ?? chars[id]?.name ?? view.state.offices?.[id]?.name ?? id;
  const catName = (id: string) => g.categories.find((c) => c.id === id)?.name ?? (id === 'memorial' ? '奏疏' : id === 'client' ? '军令' : id);
  const empty = g.draft.adopted.length === 0 && g.draft.cards.length === 0 && g.draft.ops.length === 0 && !hasText;
  const incomplete = g.draft.cards
    .map((d) => ({ d, miss: missingParams(d, cardById[d.card_id]) }))
    .filter((x) => x.miss.length)
    .map((x) => `「${cardById[x.d.card_id]?.title ?? x.d.card_id}」缺${x.miss.join('、')}`);

  useEffect(() => {
    void g.loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.seasonKey, g.aux.key]);
  useEffect(() => {
    if (hasText) setBrushOpen(true);
  }, [hasText]);

  const cite = (character: string, text: string) => {
    const name = chars[character]?.name ?? '';
    const prev = g.draft.sections[focus] ?? '';
    setBrushOpen(true);
    g.setSection(focus, `${prev}${prev && !/[。；\n]$/.test(prev) ? '。' : ''}援${name}之议：${text}`);
  };

  const polish = async () => {
    if (!g.sessionId) return;
    setPolishing(true);
    try {
      const sections = Object.fromEntries(
        g.categories.map((c) => [c.name, g.draft.sections[c.id] ?? '']).filter(([, v]) => v.trim()),
      );
      const r = await api.polishEdict(g.sessionId, sections);
      setPolished(r.text);
    } catch (err) {
      toast.error(err, '润色未成');
    } finally {
      setPolishing(false);
    }
  };

  const pick = (card: PolicyCard) => {
    const params: Record<string, string | number> = {};
    for (const p of card.params) if (p.kind === 'amount' && p.default != null) params[p.name] = Number(p.default);
    g.addCard(card.id, params);
    setPicker(false);
  };

  return (
    <PanelShell screen="edict" onClose={g.closePanel} unroll="horizontal">
      <div className="edict-desk">
        <aside className="advice-slips" aria-label="谏言">
          <div className="advice-slips-title t-title">谏言</div>
          {g.advice.length === 0 && <p className="advice-slips-empty">召对、廷议时选中臣下之言，可存为谏言，于此援引入御笔。</p>}
          {g.advice.slice(-6).map((a, i) => (
            <button key={a.id ?? i} className="advice-slip" data-testid={`edict.cite.${i}`} onClick={() => cite(a.character, a.text)} title="援引入御笔">
              <span className="advice-slip-string" aria-hidden="true" />
              <Paper variant="slip" seed={i + 40} amp={2}>
                <span className="advice-slip-who t-title">{chars[a.character]?.name ?? (a.character === 'xuanzong' ? '御批' : a.character)}</span>
                <span className="advice-slip-text">{a.text}</span>
              </Paper>
            </button>
          ))}
        </aside>

        <div className="edict-scroll-wrap">
          <Roller orientation="vertical" thickness={34} />
          <Paper variant="edict" seed={12} amp={2} sides="tb" className="edict-paper">
            <div className="edict-border">
              <header className="edict-head">
                <Baoxiang size={30} />
                <h2 className="panel-title edict-title">门下</h2>
                <Baoxiang size={30} />
              </header>

              <AnimatePresence mode="wait">
                {!receipt ? (
                  <motion.div key="compose" className="edict-compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <section className="edict-layer" data-layer="memorial">
                      <h3 className="edict-layer-head">
                        <span className="layer-num t-title">壹</span>
                        <span className="t-title">批答奏疏</span>
                        <small>奏疏中朱批「采入诏书」者，列于此</small>
                      </h3>
                      <div className="adopted-strip">
                        {g.draft.adopted.length === 0 ? (
                          <span className="adopted-empty">尚未采纳。打开奏疏册，择一项批答即列于此。</span>
                        ) : (
                          g.draft.adopted.map((a) => (
                            <span key={a.memorial_id} className="adopted-chip">
                              <b className="t-title">{a.title}</b>
                              <span>{a.label}</span>
                              {a.hint && <small>{a.hint}</small>}
                              <button data-testid={`edict.removeAdopted.${a.memorial_id}`} onClick={() => g.unadopt(a.memorial_id)} aria-label={`撤回${a.title}`}>
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="edict-layer" data-layer="cards" data-testid="edict.cards">
                      <h3 className="edict-layer-head">
                        <span className="layer-num t-title">贰</span>
                        <span className="t-title">政令</span>
                        <small>任免、调兵、赈济、修城……每道写明花费与冷却</small>
                        <button className="btn btn-ink btn-small edict-card-add" data-testid="edict.cardAdd" onClick={() => setPicker(true)}>
                          增一道政令
                        </button>
                      </h3>
                      {g.draft.cards.length === 0 && g.draft.ops.length === 0 ? (
                        <p className="edict-layer-empty">尚无政令。点「增一道政令」择卡；兵部所下军令亦列于此。</p>
                      ) : (
                        <ol className="card-clauses">
                          {g.draft.cards.map((d, i) => (
                            <CardClause key={d.uid} d={d} i={i} card={cardById[d.card_id]} loading={!cards} />
                          ))}
                          {g.draft.ops.map((o) => (
                            <li key={o.uid} className="card-clause card-clause--op" data-testid={`edict.op.${o.uid}`}>
                              <span className="card-clause-seal t-title">兵</span>
                              <div className="card-clause-body">
                                <div className="card-clause-title">
                                  <b className="t-title">军态</b>
                                  <span>{o.label}</span>
                                </div>
                                <small className="card-clause-cost">兵部所拟军令。将领或有自主之险，预览中标出。</small>
                              </div>
                              <button className="card-clause-remove" data-testid={`edict.op.${o.uid}.remove`} onClick={() => g.removeOp(o.uid)} aria-label={`撤回${o.label}`}>
                                ×
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>

                    <section className={cls('edict-layer edict-layer--brush', brushOpen && 'is-open')} data-layer="brush">
                      <h3 className="edict-layer-head">
                        <span className="layer-num t-title">叁</span>
                        <button className="edict-brush-toggle t-title" data-testid="edict.brushToggle" aria-expanded={brushOpen} onClick={() => setBrushOpen((o) => !o)}>
                          御笔 · 自由诏文 <span aria-hidden="true">{brushOpen ? '▾' : '▸'}</span>
                        </button>
                        <small className={cls('edict-brush-note', offline && 'is-offline')} data-testid="edict.brushNote">
                          {offline ? '未接模型：御笔只记入史册，不生效力' : '御笔由有司（模型）解读成条款，未必尽如圣意'}
                        </small>
                      </h3>
                      {brushOpen && (
                        <div className="edict-grid">
                          {g.categories.map((c) => (
                            <label key={c.id} className={cls('edict-section', focus === c.id && 'is-focus')}>
                              <span className="edict-seal t-title" aria-hidden="true">
                                {c.name.split('').map((ch, i) => (
                                  <span key={i}>{ch}</span>
                                ))}
                              </span>
                              <textarea
                                className="edict-text selectable"
                                data-testid={`edict.section.${c.id}`}
                                value={g.draft.sections[c.id] ?? ''}
                                placeholder={c.hint ? `${c.hint}……` : ''}
                                onFocus={() => setFocus(c.id)}
                                onChange={(e) => g.setSection(c.id, e.target.value)}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </section>
                  </motion.div>
                ) : (
                  <Receipt key="receipt" receipt={receipt} turn={g.view?.state.turn ?? 0} catName={catName} resName={resName} entName={entName} hidden={hidden} />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {picker && !receipt && <CardPicker key="picker" cards={cards} onPick={pick} onClose={() => setPicker(false)} />}
              </AnimatePresence>

              <AnimatePresence>
                {polished && (
                  <motion.div className="polish-sheet" data-testid="edict.polished" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="section-label">润色稿（仅供参阅，颁布仍以御笔四栏为准）</div>
                    <p className="selectable">{polished}</p>
                    <button className="btn btn-outline btn-small" data-testid="edict.polishClose" onClick={() => setPolished(null)}>
                      收起
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Paper>
          <Roller orientation="vertical" thickness={34} />
        </div>

        <aside className="edict-actions">
          {!receipt && (
            <>
              <button className="plaque-btn" data-testid="edict.debate" onClick={() => g.openPanel('debate')}>
                <span className="t-title">廷议</span>
              </button>
              <button className="plaque-btn" data-testid="edict.army" onClick={() => g.openPanel('army')}>
                <span className="t-title">兵部</span>
              </button>
              <button className="plaque-btn" data-testid="edict.polish" disabled={polishing || !hasText} title={hasText ? undefined : '御笔尚无一字'} onClick={polish}>
                <span className="t-title">{polishing ? '润色中' : '润色'}</span>
              </button>
              <button
                className="plaque-btn plaque-btn--primary"
                data-testid="edict.preview"
                disabled={g.busy.draft || empty || incomplete.length > 0}
                title={empty ? '诏书尚无一条' : incomplete.length ? `政令尚缺参数：${incomplete.join('；')}` : '交有司逐条回执'}
                onClick={g.draftEdict}
              >
                <span className="t-title">{g.busy.draft ? '拟定中' : '预览'}</span>
              </button>
              {g.busy.draft && (
                <button className="btn btn-outline btn-outline--dark btn-small" data-testid="edict.cancel" onClick={g.cancelDraft}>
                  中止
                </button>
              )}
              <div className="edict-hint">{incomplete.length ? `政令尚缺参数：${incomplete.join('；')}` : '先「预览」，由有司逐条回执，再用宝颁布。'}</div>
            </>
          )}
          {receipt && !receipt.confirmed && (
            <>
              <button className="plaque-btn" data-testid="edict.backToEdit" onClick={g.clearReceipt}>
                <span className="t-title">改拟</span>
              </button>
              <button className="seal-btn edict-seal-btn" data-testid="edict.promulgate" disabled={g.busy.confirm} onClick={g.confirmEdict}>
                <span className="t-title">{g.busy.confirm ? '用宝' : '颁布'}</span>
              </button>
            </>
          )}
          {receipt?.confirmed && (
            <>
              <div className="promulgated-stamp t-title" aria-label="已颁行">
                已颁行
              </div>
              <button className="btn btn-ink" data-testid="edict.advance" onClick={() => void g.advanceTurn()} disabled={g.busy.turn}>
                推演本季
              </button>
              <button className="btn btn-outline btn-outline--dark" data-testid="edict.newDraft" onClick={g.clearReceipt}>
                续拟一道
              </button>
            </>
          )}
        </aside>
      </div>
    </PanelShell>
  );
}

/** One policy card in the draft: its parameters as pickers, its cost, cooldown and conditions. */
function CardClause({ d, i, card, loading }: { d: DraftCard; i: number; card: PolicyCard | undefined; loading: boolean }) {
  const g = useGame();
  const miss = missingParams(d, card);
  const army = card?.params.find((p) => p.kind === 'army');
  const armyId = army ? String(d.params[army.name] ?? '') : '';
  const etas = g.aux.armies?.armies.find((a) => a.id === armyId)?.etas;
  useEffect(() => {
    if (army && card?.params.some((p) => p.kind === 'region')) void g.loadArmies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [army?.name]);
  return (
    <li className={cls('card-clause', miss.length > 0 && 'is-incomplete', card && !card.available && 'is-unavailable')} data-testid={`edict.card.${i}`} data-card={d.card_id}>
      <span className="card-clause-seal t-title" title={card?.category}>
        {CAT_GLYPH[card?.category ?? ''] ?? '令'}
      </span>
      <div className="card-clause-body">
        <div className="card-clause-title">
          <b className="t-title">{card?.title ?? (loading ? '…' : d.card_id)}</b>
          <span className="card-clause-cat">{card?.category}</span>
          {card?.cooldown ? <span className="card-clause-cd">冷却 {card.cooldown} 季</span> : null}
          {card && !card.available && <span className="card-clause-warn">{card.unavailable_reason || '暂不可用'}</span>}
          {miss.length > 0 && <span className="card-clause-warn">尚缺：{miss.join('、')}</span>}
        </div>
        {card && card.params.length > 0 && (
          <div className="card-params">
            {card.params.map((p) => {
              const id = `edict.card.${i}.param.${p.name}`;
              const value = d.params[p.name];
              if (p.kind === 'amount')
                return (
                  <label key={p.name} className="card-param">
                    <span>{p.label ?? p.name}</span>
                    <input
                      type="number"
                      className="field t-num"
                      data-testid={id}
                      min={p.min}
                      max={p.max}
                      step={p.max != null && p.max >= 10000 ? 1000 : 1}
                      value={value ?? ''}
                      placeholder={p.min != null && p.max != null ? `${p.min}–${p.max}` : ''}
                      onChange={(e) => g.setCardParam(d.uid, p.name, e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                );
              return (
                <label key={p.name} className="card-param">
                  <span>{p.label ?? p.name}</span>
                  <select className="field" data-testid={id} value={value === undefined ? '' : String(value)} onChange={(e) => g.setCardParam(d.uid, p.name, e.target.value || null)}>
                    <option value="">— 择{p.label ?? ''} —</option>
                    {(p.options ?? []).map((o) => {
                      const eta = p.kind === 'region' && etas ? etas[o.id] : undefined;
                      return (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {eta != null && eta > 0 ? ` · 约${eta}季` : o.note ? `（${o.note}）` : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            })}
          </div>
        )}
        {card?.cost_hint && <small className="card-clause-cost">{card.cost_hint}</small>}
      </div>
      <button className="card-clause-remove" data-testid={`edict.card.${i}.remove`} onClick={() => g.removeCard(d.uid)} aria-label={`撤回${card?.title ?? '此令'}`}>
        ×
      </button>
    </li>
  );
}

/** The card picker: cards grouped by category, each with its summary, cost and availability. */
function CardPicker({ cards, onPick, onClose }: { cards: PolicyCard[] | null | undefined; onPick: (c: PolicyCard) => void; onClose: () => void }) {
  const g = useGame();
  const cats = CARD_CATEGORIES.filter((c) => (cards ?? []).some((x) => x.category === c));
  const [cat, setCat] = useState<string>(cats[0] ?? '军务');
  useEffect(() => {
    if (cats.length && !cats.includes(cat)) setCat(cats[0]);
  }, [cats, cat]);
  const inDraft = (id: string) => g.draft.cards.some((c) => c.card_id === id);
  return (
    <motion.div className="card-picker" data-testid="edict.cardPicker" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.22 }}>
      <header className="card-picker-head">
        <h3 className="t-title">增一道政令</h3>
        <div className="tabs card-picker-tabs" role="tablist">
          {cats.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={cls('tab t-title', cat === c && 'is-on')} data-testid={`edict.cardCat.${c}`} disabled={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-small" data-testid="edict.cardPickerClose" onClick={onClose}>
          作罢
        </button>
      </header>
      {!cards ? (
        <div className="ink-loader">
          <i />
          <i />
          <i /> 检取政令卡
        </div>
      ) : (
        <ul className="card-grid">
          {cards
            .filter((c) => c.category === cat)
            .map((c) => {
              const once = Boolean(c.cooldown) && inDraft(c.id);
              const why = !c.available ? c.unavailable_reason || '暂不可用' : once ? '有冷却之卡，一道诏书只用一次' : '';
              return (
                <li key={c.id}>
                  <button className={cls('policy-card', why && 'is-off')} data-testid={`edict.cardPick.${c.id}`} disabled={Boolean(why)} title={why || `${c.title}：${c.summary}`} onClick={() => onPick(c)}>
                    <span className="policy-card-head">
                      <span className="policy-card-seal t-title">{CAT_GLYPH[c.category] ?? '令'}</span>
                      <b className="t-title">{c.title}</b>
                      {c.cooldown ? <span className="policy-card-cd">{c.cooldown_left ? `冷却余 ${c.cooldown_left} 季` : `冷却 ${c.cooldown} 季`}</span> : null}
                    </span>
                    <span className="policy-card-summary">{c.summary}</span>
                    {c.cost_hint && <span className="policy-card-cost">{c.cost_hint}</span>}
                    {why && <span className="policy-card-why">{why}</span>}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </motion.div>
  );
}

function Receipt({ receipt, turn, catName, resName, entName, hidden }: { receipt: EdictReceipt; turn: number; catName: (id: string) => string; resName: (id: string) => string; entName: (id: string) => string; hidden: (id: string) => boolean }) {
  const groups = groupClauses(receipt.clauses);
  const counts = groups.reduce<Record<string, number>>((acc, g) => ({ ...acc, [g.first.status]: (acc[g.first.status] ?? 0) + 1 }), {});
  const delays = groups.reduce<Record<string, number>>((acc, g) => {
    const k = delayKindLabel(g.first);
    return k ? { ...acc, [k]: (acc[k] ?? 0) + 1 } : acc;
  }, {});
  return (
    <motion.div className="receipt" data-testid="edict.receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="receipt-head">
        <span className="t-title">有司回执</span>
        <span className="receipt-rate">
          施行率 <b className="t-num">{Math.round(receipt.execution_rate * 100)}%</b>
        </span>
        <span className="receipt-counts">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className={cls('receipt-count', STATUS[k]?.cls)}>
              {STATUS[k]?.name ?? k} <b className="t-num">{v}</b>
            </span>
          ))}
        </span>
        {Object.keys(delays).length > 0 && (
          <span className="receipt-delays" data-testid="edict.receipt.delays">
            {Object.entries(delays)
              .map(([k, v]) => `${k} ${v}`)
              .join(' · ')}
          </span>
        )}
      </div>
      <ol className="receipt-list">
        {groups.map((gr, i) => (
          <ClauseRow key={i} c={gr.first} group={gr.items} i={i} turn={turn} catName={catName} resName={resName} entName={entName} hidden={hidden} />
        ))}
      </ol>
    </motion.div>
  );
}

/** The engine emits one clause per op; show one row per edict sentence / adopted option / card and status. */
export function groupClauses(clauses: Clause[]): { first: Clause; items: Clause[] }[] {
  const out: { key: string; first: Clause; items: Clause[] }[] = [];
  for (const c of clauses) {
    const key = `${c.group ?? ''}|${c.memorial_id ?? ''}|${c.card_id ?? ''}|${c.category}|${c.text}|${c.status}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(c);
    else out.push({ key, first: c, items: [c] });
  }
  return out;
}

/** Rejection codes worth naming for the player (the reason text carries the detail). */
const CODE_NAMES: Record<string, string> = {
  OP_NOT_PERMITTED: '非君命所及',
  INVALID_TARGET: '查无其人其地',
  OFFLINE_TEXT: '未接模型',
  UNKNOWN_CARD: '无此政令',
  CARD_UNAVAILABLE: '条件未备',
  CARD_PARAM_MISSING: '参数未备',
  INVALID_CARD_PARAM: '参数不合',
  CARD_COOLDOWN: '冷却未满',
};

function ClauseRow({ c, group, i, turn, catName, resName, entName, hidden }: { c: Clause; group: Clause[]; i: number; turn: number; catName: (id: string) => string; resName: (id: string) => string; entName: (id: string) => string; hidden: (id: string) => boolean }) {
  const st = STATUS[c.status] ?? STATUS.narrative_only;
  const ops = group
    .flatMap((g) => (g.summary ? [g.summary] : (g.ops?.length ? g.ops : g.op ? [g.op] : []).map((o) => opSummary(o, { res: resName, ent: entName, hidden }))))
    .filter((x) => x && !/记入档案/.test(x) && x.trim() !== c.text.trim());
  const reason = Array.from(new Set(group.map((g) => g.delay_reason || g.reason).filter(Boolean))).join('；');
  const due = c.status === 'delayed' && c.due_turn != null ? (c.due_turn <= turn + 1 ? '次季施行' : `${c.due_turn - turn}季后施行`) : '';
  const code = c.code ? CODE_NAMES[c.code] : undefined;
  const delay = delayKindLabel(c);
  const risk = group.map((g) => g.autonomy_risk).find(Boolean) ?? null;
  const riskNote = group.map((g) => g.autonomy_note).find(Boolean);
  const source = c.source ? SOURCE_NAMES[c.source] ?? c.source : null;
  const showCat = c.category !== 'memorial' && c.category !== 'client' && c.source !== 'card';
  return (
    <motion.li className={cls('clause', st.cls)} data-testid={`edict.clause.${i}`} data-status={c.status} data-source={c.source ?? ''} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.06 }}>
      <span className="clause-seal t-title">{st.glyph}</span>
      <div className="clause-body">
        <div className="clause-meta">
          {source && <span className={cls('clause-source', `clause-source--${c.source}`)}>{source}</span>}
          {c.source === 'card' && c.card_title && <span className="clause-card">「{c.card_title}」</span>}
          {showCat && <span>{catName(c.category)}</span>}
          <span className="clause-status">{st.name}</span>
          {delay && (
            <span className={cls('clause-delay', c.delay_kind === 'courier' && 'is-courier')} data-testid={`edict.clause.${i}.delay`}>
              {delay}
            </span>
          )}
          {due && <span className="clause-due">{due}</span>}
          {risk && (
            <span className={cls('risk-tag', riskClass(risk))} data-testid={`edict.clause.${i}.risk`} title={riskNote}>
              将领自主风险 {risk}
            </span>
          )}
          {code && <span className="clause-code" data-code={c.code}>{code}</span>}
        </div>
        <div className="clause-text">{c.text}</div>
        {ops.length > 0 && <div className="clause-ops">{ops.join('　')}</div>}
        {reason && <div className="clause-reason">{reason}</div>}
        {riskNote && risk !== '低' && c.status !== 'rejected' && <div className="clause-risk-note">{riskNote}；拒命或擅动者，结算时写入史册</div>}
      </div>
    </motion.li>
  );
}
