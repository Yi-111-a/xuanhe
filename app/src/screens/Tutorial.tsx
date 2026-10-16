// 新手引导 (CONTRACT §7.6): the season's steps from /view.tutorial, one at a time — a soft gilt ring
// around the target control (its data-testid; a trailing `*` means any of that group) and a
// parchment note beside it with 「下一步」/「跳过引导」. When the target sits in a panel that is not
// open, the ring points at the control that opens it. Never blocks the page: only the note's own
// buttons take clicks, and clicking the highlighted control moves on to the next step.
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../store/game';
import { cls } from '../lib/util';

const OPENERS: [string, string, string][] = [
  ['memorial.', 'desk.memorialBook', '先打开案上的奏疏册'],
  ['edict.', 'desk.edictScroll', '先展开「拟诏」卷轴'],
  ['audience.', 'desk.medallion.audience', '先点「召」开召对'],
  ['debate.', 'desk.medallion.debate', '先点「议」开廷议'],
  ['army.', 'desk.medallion.army', '先点「兵」开兵部'],
  ['replies.', 'desk.replies', '先打开案上的「回奏」'],
  ['advice.', 'desk.medallion.advice', '先点「谏」开谏言库'],
];

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none';
}

function find(target: string): Element | null {
  const sel = target.endsWith('*') ? `[data-testid^="${target.slice(0, -1)}"]` : `[data-testid="${target}"]`;
  const all = [...document.querySelectorAll(sel)].filter((el) => !el.closest('.tut-layer'));
  return all.find((el) => visible(el) && !(el as HTMLButtonElement).disabled) ?? all.find(visible) ?? null;
}

interface Aim {
  rect: { l: number; t: number; r: number; b: number };
  /** pointing at the opener / close button instead of the step's own target */
  hint: string | null;
  real: boolean;
}

/** Where the ring goes for a target: the control itself, else the way to reach it. */
function aim(target: string): Aim | null {
  const overlay = document.querySelector('.overlay');
  let el = find(target);
  let hint: string | null = null;
  // a desk control under an open panel: point at that panel's close button
  if (el && overlay && !overlay.contains(el) && !el.closest('.army-drawer')) {
    const close = overlay.querySelector('[data-testid$=".close"]');
    if (close && visible(close)) {
      el = close;
      hint = '先收起此卷，回到御案';
    } else return null;
  }
  if (!el) {
    const opener = OPENERS.find(([prefix]) => target.startsWith(prefix));
    if (opener) {
      if (overlay) {
        const close = overlay.querySelector('[data-testid$=".close"]');
        // the panel the step wants is not the one open: close this one first
        if (close && visible(close) && !overlay.querySelector(`[data-screen="${opener[0].slice(0, -1)}"]`) && overlay.getAttribute('data-screen') !== opener[0].slice(0, -1)) {
          el = close;
          hint = '先收起此卷';
        }
      } else {
        el = find(opener[1]);
        hint = opener[2];
      }
    }
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { rect: { l: r.left, t: r.top, r: r.right, b: r.bottom }, hint, real: hint === null };
}

const CARD_W = 320;
const GAP = 16;

function place(rect: Aim['rect'], h: number): { left: number; top: number; side: string } {
  const vw = innerWidth;
  const vh = innerHeight;
  const clampY = (y: number) => Math.max(10, Math.min(vh - h - 10, y));
  const clampX = (x: number) => Math.max(10, Math.min(vw - CARD_W - 10, x));
  const midY = (rect.t + rect.b) / 2 - h / 2;
  // beside the target, on its outer side first (panels sit in the middle: the note stays off them)
  const right = vw - rect.r - GAP >= CARD_W + 10 ? { left: rect.r + GAP, top: clampY(midY), side: 'right' } : null;
  const left = rect.l - GAP >= CARD_W + 10 ? { left: rect.l - GAP - CARD_W, top: clampY(midY), side: 'left' } : null;
  const outerLeft = (rect.l + rect.r) / 2 < vw / 2;
  const side = outerLeft ? left ?? right : right ?? left;
  if (side) return side;
  const midX = clampX((rect.l + rect.r) / 2 - CARD_W / 2);
  if (vh - rect.b - GAP >= h + 10) return { left: midX, top: rect.b + GAP, side: 'below' };
  return { left: midX, top: Math.max(10, rect.t - GAP - h), side: 'above' };
}

const readIdx = (key: string) => {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
};

export function Tutorial() {
  const g = useGame();
  const tut = g.view?.tutorial;
  const steps = tut?.enabled && g.screen === 'desk' ? tut.steps : [];
  const key = `tianbao.tutorial.${g.seasonKey}`;
  const [idx, setIdx] = useState(() => readIdx(key));
  const [target, setTarget] = useState<Aim | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);
  useEffect(() => setIdx(readIdx(key)), [key]);
  const step = steps[idx] ?? null;

  const go = useCallback(
    (n: number) => {
      setIdx(n);
      try {
        localStorage.setItem(key, String(n));
      } catch {
        /* per-viewer convenience only */
      }
    },
    [key],
  );

  // follow the target as panels open, animate and scroll
  useEffect(() => {
    if (!step || g.busy.turn) {
      setTarget(null);
      return;
    }
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const a = aim(step.target);
      setTarget((prev) => {
        if (!a || !prev) return a;
        const same = Math.abs(prev.rect.l - a.rect.l) < 0.5 && Math.abs(prev.rect.t - a.rect.t) < 0.5 && Math.abs(prev.rect.r - a.rect.r) < 0.5 && Math.abs(prev.rect.b - a.rect.b) < 0.5 && prev.hint === a.hint;
        return same ? prev : a;
      });
    };
    tick();
    const id = window.setInterval(tick, 160);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [step, g.busy.turn]);

  // clicking the highlighted control itself counts as doing the step
  useEffect(() => {
    if (!step) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest('.tut-layer')) return;
      const t = find(step.target);
      if (t && (t === el || t.contains(el))) window.setTimeout(() => go(idx + 1), 80);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step, idx, go]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step, target?.hint]);

  if (!step) return null;
  const pad = 6;
  const pos = target ? place({ l: target.rect.l - pad, t: target.rect.t - pad, r: target.rect.r + pad, b: target.rect.b + pad }, cardH) : null;
  const total = steps.length;

  return (
    <div className="tut-layer" data-testid="tutorial.root" data-step={`${step.turn}.${step.step}`} data-target={step.target}>
      <AnimatePresence>
        {target && (
          <motion.div
            key="ring"
            className={cls('tut-ring', !target.real && 'is-hint')}
            data-testid="tutorial.ring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ left: target.rect.l - pad, top: target.rect.t - pad, width: target.rect.r - target.rect.l + pad * 2, height: target.rect.b - target.rect.t + pad * 2 }}
          />
        )}
      </AnimatePresence>
      <motion.div
        ref={cardRef}
        key={`${step.turn}.${step.step}`}
        className={cls('tut-card', pos && `tut-card--${pos.side}`, !target && 'is-floating')}
        data-testid="tutorial.card"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={pos ? { left: pos.left, top: pos.top, width: CARD_W } : { width: CARD_W }}
      >
        <div className="tut-kicker">
          新手引导 · 第 {idx + 1}/{total} 步
        </div>
        <h4 className="tut-title t-title">{step.title}</h4>
        <p className="tut-text">{step.text}</p>
        {target?.hint && <p className="tut-hint">{target.hint}</p>}
        <div className="tut-actions">
          <button className="btn btn-outline btn-small" data-testid="tutorial.skip" onClick={() => void g.setTutorial(false)} title="关闭新手引导（可在「设置 · 对局」中重新开启）">
            跳过引导
          </button>
          <button className="btn btn-ink btn-small" data-testid="tutorial.next" onClick={() => go(idx + 1)}>
            {idx + 1 >= total ? '知道了' : '下一步'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
