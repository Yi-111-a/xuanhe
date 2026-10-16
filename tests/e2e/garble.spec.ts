// G4 乱码扫描: every screen's DOM text is free of U+FFFD, 锟斤拷 and UTF-8-as-Latin-1 mojibake,
// every CJK character shown is covered by the bundled font subset, and all static UI and
// scenario text is covered too.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { collectText, openScreen, REAL, SCREENS, settle, startGame, watchErrors } from './helpers';

const here = __dirname; // specs are compiled as CommonJS by Playwright
const ROOT = path.resolve(here, '..', '..');
const SUBSET = path.join(ROOT, 'app', 'src', 'assets', 'fonts', 'subset-chars.json');

const MOJIBAKE = /[ÃÂåæçèéä][\u0080-¿]/;
const CJK = /[㐀-鿿豈-﫿]/gu;

function subset(): { body: Set<string>; title: Set<string> } {
  const raw = JSON.parse(fs.readFileSync(SUBSET, 'utf-8')) as { body: string; title: string };
  return { body: new Set([...raw.body]), title: new Set([...raw.title]) };
}

/** Every entity id of the scenario (factions, regions, characters, armies, offices, resources,
 *  events, endings, blocs): none of them may ever be shown to the player as text. */
function scenarioIds(): Set<string> {
  const dir = path.join(ROOT, 'scenarios', 'tianbao_751');
  const load = (f: string) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf-8')) as unknown;
  const ids = new Set<string>();
  const add = (rows: unknown) => {
    for (const r of Array.isArray(rows) ? rows : []) if (r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string') ids.add((r as { id: string }).id);
  };
  for (const f of ['factions.yaml', 'regions.yaml', 'characters.yaml', 'armies.yaml', 'events.yaml']) add(load(f));
  const sc = load('scenario.yaml') as Record<string, unknown>;
  for (const k of ['offices', 'resources', 'stats', 'endings']) add(sc[k]);
  for (const id of Object.keys(((sc.settings as Record<string, unknown>)?.bloc_names as object) ?? {})) ids.add(id);
  return ids;
}
const IDS = scenarioIds();

/** Visible text only (form fields hold what the player typed). */
async function visibleText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.body.innerText];
    document.querySelectorAll('svg text').forEach((el) => parts.push(el.textContent ?? ''));
    document.querySelectorAll('[title],[aria-label],[alt]').forEach((el) => {
      for (const a of ['title', 'aria-label', 'alt']) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    });
    return parts.join(' \n ');
  });
}

function idLeaks(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)) if (IDS.has(m[0])) out.add(`${m[0]} in "…${text.slice(Math.max(0, m.index! - 8), m.index! + m[0].length + 8).replace(/\s+/g, ' ')}…"`);
  return [...out];
}

function garbleProblems(text: string): string[] {
  const out: string[] = [];
  if (text.includes('�')) out.push('contains U+FFFD replacement character');
  if (text.includes('锟斤拷')) out.push('contains 锟斤拷');
  const m = text.match(MOJIBAKE);
  if (m) out.push(`mojibake pattern near "${text.slice(Math.max(0, m.index! - 10), m.index! + 10)}"`);
  return out;
}

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

test.describe('garble / font coverage (G4)', () => {
  test('static UI and scenario text are UTF-8 clean and covered by the bundled subset', () => {
    const { body } = subset();
    const files = [
      ...walk(path.join(ROOT, 'app', 'src'), ['.ts', '.tsx', '.css', '.html']).filter((f) => !f.endsWith('subset-chars.json')),
      path.join(ROOT, 'app', 'index.html'),
      ...walk(path.join(ROOT, 'scenarios', 'tianbao_751'), ['.yaml', '.yml', '.md', '.json', '.txt']),
    ];
    expect(files.length).toBeGreaterThan(10);
    const missing = new Map<string, string>();
    for (const f of files) {
      const buf = fs.readFileSync(f);
      // strict UTF-8 decode: throws on invalid sequences
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      expect(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, `${f} has a UTF-8 BOM`).toBe(false);
      expect(garbleProblems(text), f).toEqual([]);
      for (const ch of text.match(CJK) ?? []) if (!body.has(ch)) missing.set(ch, path.relative(ROOT, f));
    }
    expect([...missing.entries()].map(([c, f]) => `${c} (${f})`), 'CJK chars not in bundled font subset').toEqual([]);
  });

  for (const screen of SCREENS) {
    test(`screen "${screen}" shows no garbled text and only covered glyphs`, async ({ page }) => {
      const errors = watchErrors(page);
      const reached = await openScreen(page, screen);
      test.skip(!reached, `screen ${screen} not reachable in ${REAL ? 'real' : 'mock'} mode`);
      const text = await collectText(page);
      expect(text.length, 'screen has text').toBeGreaterThan(4);
      expect(garbleProblems(text)).toEqual([]);
      expect(idLeaks(await visibleText(page)), 'raw entity ids shown as text').toEqual([]);
      const { body } = subset();
      const uncovered = [...new Set(text.match(CJK) ?? [])].filter((c) => !body.has(c));
      expect(uncovered, 'DOM CJK chars outside the bundled subset').toEqual([]);
      // the bundled faces are the ones actually used
      const fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
          serif: document.fonts.check('16px "TB Serif"', '天宝'),
          title: document.fonts.check('16px "TB WenKai"', '天宝'),
          loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
        };
      });
      expect(fonts.serif && fonts.title, JSON.stringify(fonts)).toBe(true);
      expect(fonts.loaded.map((f) => f.replace(/"/g, '')), 'bundled faces loaded').toEqual(expect.arrayContaining(['TB Serif', 'TB WenKai']));
      expect(errors).toEqual([]);
    });
  }

  test('a season full of raw-id engine text shows only display names', async ({ page }) => {
    test.skip(REAL, 'stress content comes from the mock backend');
    expect(IDS.size).toBeGreaterThan(50);
    const errors = watchErrors(page);
    await startGame(page);
    await page.evaluate(() => {
      const id = JSON.parse(localStorage.getItem('tianbao.session') ?? 'null') as string;
      window.__tianbaoMock?.stress(id, true);
    });
    await page.getByTestId('desk.advance').click();
    if (await page.getByTestId('desk.advance.confirm').isVisible().catch(() => false)) await page.getByTestId('desk.advance.confirm').click();
    await expect(page.getByTestId('result.root')).toBeVisible({ timeout: 30_000 });
    await settle(page, 900);
    // the mock's stress battles carry bare faction ids (attacker: 'yan', defender: 'tang')
    await expect(page.getByTestId('result.battle.0')).toContainText(/大燕|唐廷/);
    expect(idLeaks(await visibleText(page))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
