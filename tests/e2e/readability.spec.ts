// Readability (user priority): on every paper panel, body text is large enough and dark enough.
//  * prose (an element whose own text has ≥ 8 characters) ≥ 16px at 1920×1080, ≥ 14px at 1366×768;
//    every other text on paper ≥ 14px / 13px;
//  * WCAG contrast of the text colour against the *measured* average colour of the surface it sits
//    on (the paper texture, a tab, a chip…: the nearest ancestor that paints a background, captured
//    with its contents hidden) ≥ 4.5:1, or ≥ 3:1 for large text (≥ 24px, or ≥ 18.66px bold).
import { expect, test, type Page } from '@playwright/test';
import { openScreen, REAL, watchErrors, type ScreenName } from './helpers';

const SIZES = [
  { width: 1920, height: 1080, prose: 16, floor: 14 },
  { width: 1366, height: 768, prose: 14, floor: 13 },
];
const SCREENS: ScreenName[] = ['newgame', 'memorial', 'edict', 'result', 'choice', 'audience', 'debate', 'timeline', 'settings', 'advice', 'command', 'ending', 'army', 'replies'];

interface TextProbe {
  text: string;
  size: number;
  weight: number;
  color: [number, number, number, number];
  opacity: number;
  bg: number; // index into the probe list of background elements
}

/** Marks the text elements on paper and the surfaces behind them; returns the text probes. */
async function collect(page: Page): Promise<{ texts: TextProbe[]; surfaces: number }> {
  return page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    // the part of an element actually on screen: clipped by the viewport and scroll containers
    const shownRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      let [x0, y0, x1, y1] = [Math.max(0, r.left), Math.max(0, r.top), Math.min(innerWidth, r.right), Math.min(innerHeight, r.bottom)];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
        const q = p.getBoundingClientRect();
        [x0, y0, x1, y1] = [Math.max(x0, q.left), Math.max(y0, q.top), Math.min(x1, q.right), Math.min(y1, q.bottom)];
      }
      return { x0, y0, x1, y1, full: Math.max(1, r.width * r.height), area: Math.max(0, x1 - x0) * Math.max(0, y1 - y0) };
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const v = shownRect(el);
      if (v.area < 0.6 * v.full) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none';
    };
    (window as unknown as { __shownRect: typeof shownRect }).__shownRect = shownRect;
    document.querySelectorAll('[data-probe-surface]').forEach((el) => el.removeAttribute('data-probe-surface'));
    const surfaces: Element[] = [];
    const texts: TextProbe[] = [];
    const papers = [...document.querySelectorAll('.paper')].filter(visible);
    const seen = new Set<Element>();
    for (const paper of papers) {
      for (const el of [paper, ...paper.querySelectorAll('*')]) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.closest('svg, textarea, input, select, [aria-hidden="true"], .sr-only')) continue;
        if ((el as HTMLButtonElement).disabled || el.closest('button:disabled')) continue;
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .replace(/\s+/g, '');
        if (!own || !visible(el)) continue;
        const s = getComputedStyle(el);
        if (Number(s.opacity) === 0 || s.color === 'rgba(0, 0, 0, 0)') continue;
        // nearest ancestor (up to the paper) that paints a background
        let bgEl: Element = paper;
        let opacity = 1;
        for (let p: Element | null = el; p; p = p.parentElement) {
          const ps = getComputedStyle(p);
          opacity *= Number(ps.opacity);
          if (bgEl === paper && (parse(ps.backgroundColor)[3] >= 0.3 || ps.backgroundImage !== 'none' || ps.borderImageSource !== 'none')) bgEl = p;
          if (p === paper) break;
        }
        let idx = surfaces.indexOf(bgEl);
        if (idx < 0) {
          idx = surfaces.push(bgEl) - 1;
          bgEl.setAttribute('data-probe-surface', String(idx));
        }
        texts.push({ text: own.slice(0, 24), size: parseFloat(s.fontSize), weight: Number(s.fontWeight) || 400, color: parse(s.color), opacity, bg: idx });
      }
    }
    return { texts, surfaces: surfaces.length };
  });
}

/** Average colour of a surface with all its contents hidden, measured from a real screenshot. */
async function surfaceColour(page: Page, idx: number): Promise<[number, number, number] | null> {
  const box = await page.evaluate((i) => {
    const el = document.querySelector(`[data-probe-surface="${i}"]`);
    if (!el) return null;
    el.setAttribute('data-probe-hide', '');
    const v = (window as unknown as { __shownRect: (e: Element) => { x0: number; y0: number; x1: number; y1: number } }).__shownRect(el);
    const w = v.x1 - v.x0;
    const h = v.y1 - v.y0;
    return w > 2 && h > 2 ? { x: v.x0, y: v.y0, width: w, height: h } : null;
  }, idx);
  if (!box) return null;
  const png = await page.screenshot({ clip: box, animations: 'disabled' });
  await page.evaluate((i) => document.querySelector(`[data-probe-surface="${i}"]`)?.removeAttribute('data-probe-hide'), idx);
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    return [r / n, g / n, b / n] as [number, number, number];
  }, png.toString('base64'));
}

const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test.skip(REAL, 'layout/readability is checked against the mock backend');

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const screen of SCREENS) {
      test(`readable text on paper: ${screen} @readability`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.addInitScript(() => {
          const style = document.createElement('style');
          style.textContent = '[data-probe-hide] * { visibility: hidden !important; }';
          document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
        });
        expect(await openScreen(page, screen)).toBe(true);
        await page.waitForTimeout(900);
        const { texts, surfaces } = await collect(page);
        expect(texts.length, 'text found on paper').toBeGreaterThan(2);
        const colours: ([number, number, number] | null)[] = [];
        for (let i = 0; i < surfaces; i++) colours.push(await surfaceColour(page, i));
        const problems: string[] = [];
        for (const t of texts) {
          const prose = [...t.text].length >= 8;
          const min = prose ? size.prose : size.floor;
          if (t.size + 0.01 < min) problems.push(`「${t.text}」 ${t.size}px < ${min}px${prose ? ' (prose)' : ''}`);
          const bg = colours[t.bg];
          if (!bg) continue;
          const a = t.color[3] * t.opacity;
          const fg = t.color.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a));
          const ratio = contrast(fg, bg);
          const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 600);
          const need = large ? 3 : 4.5;
          if (ratio < need)
            problems.push(`「${t.text}」 contrast ${ratio.toFixed(2)} < ${need} (text rgb(${fg.map(Math.round).join(',')}) on rgb(${bg.map(Math.round).join(',')}))`);
        }
        test.info().annotations.push({ type: 'surfaces', description: colours.map((c) => (c ? `rgb(${c.map(Math.round).join(',')})` : '-')).join(' ') });
        expect(problems, `${screen} readability`).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}
