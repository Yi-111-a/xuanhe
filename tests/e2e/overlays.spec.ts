// G1 layout stress (mock only): every overlay keeps its header and action buttons on screen and
// clickable when its body holds far more content than any real season (the body scrolls inside
// the panel instead). Regression for "result.root intercepts pointer events" on long seasons.
import { expect, test, type Page } from '@playwright/test';
import { openBrush, REAL, settle, startGame, watchErrors } from './helpers';

test.skip(REAL, 'stress content comes from the mock backend');

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

/** The element is inside the viewport and is what a click at its centre would hit. Action buttons
 *  are checked where they are; list entries (`scroll`) may first be scrolled into view inside
 *  their own scroll container. */
async function assertClickable(page: Page, testid: string, scroll = false) {
  const loc = page.getByTestId(testid).first();
  await expect(loc, testid).toBeVisible();
  if (scroll) await loc.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  const verdict = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1)
      return `outside viewport (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)})`;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (hit === el || el.contains(hit))) return 'ok';
    return `covered by <${hit?.tagName.toLowerCase()} class="${hit?.getAttribute('class') ?? ''}">`;
  });
  if (verdict !== 'ok') await page.screenshot({ path: test.info().outputPath(`unclickable-${testid}.png`) });
  expect(verdict, `${testid} must be clickable`).toBe('ok');
  await loc.click({ trial: true });
}

/** Every panel title of the open overlay lies fully inside the viewport. */
async function assertHeaderVisible(page: Page, root: string, selector = '.panel-title, .result-title, .choice-title, .ending-title, .ledger-title') {
  const titles = await page.getByTestId(root).locator(selector).evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      // headings that live inside a scrolling body (e.g. the crisis heading in the ledger) may scroll away
      .filter((el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const st = getComputedStyle(p);
          if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 2) return false;
        }
        return true;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent ?? '').trim().slice(0, 12), top: Math.round(r.top), bottom: Math.round(r.bottom), inside: r.top >= -1 && r.bottom <= innerHeight + 1 };
      }),
  );
  expect(titles.length, `${root} has a title`).toBeGreaterThan(0);
  expect(titles.filter((t) => !t.inside), `${root} titles outside the viewport`).toEqual([]);
}

/** The scroll container that holds the long content really scrolls (content is not clipped). */
async function assertScrolls(page: Page, root: string) {
  const scrollers = await page.getByTestId(root).evaluate((el) =>
    [...el.querySelectorAll('*')].filter((n) => {
      const s = getComputedStyle(n);
      return /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4;
    }).length,
  );
  expect(scrollers, `${root} has an internally scrolling body`).toBeGreaterThan(0);
}

/** Waits until the open panel has finished its unroll / fade-in animation. */
async function panelSettled(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.overlay > .panel, .overlay .choice')].every((el) => {
      const s = getComputedStyle(el);
      return Number(s.opacity) > 0.99 && (s.clipPath === 'none' || /^inset\((0(px|%)?\s*)+\)$/.test(s.clipPath)) && !/matrix\(0\.9/.test(s.transform);
    }),
  );
  await settle(page, 150);
}

async function stress(page: Page) {
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('tianbao.session') ?? 'null') as string;
    window.__tianbaoMock?.stress(id, true);
    window.dispatchEvent(new Event('tianbao:refresh'));
  });
  await settle(page, 400);
}

const LONG_EDICT = Array.from({ length: 14 }, (_, i) => `命第${i + 1}路御史巡察诸道吏治`).join('。') + '。';

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('overlays stay usable with very long content @layout', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await startGame(page);
      await stress(page);

      // memorial: many long items
      await page.getByTestId('desk.memorialBook').click();
      await expect(page.getByTestId('memorial.root')).toBeVisible();
      await panelSettled(page);
      await assertHeaderVisible(page, 'memorial.root');
      for (const id of ['memorial.toEdict', 'memorial.done', 'memorial.close']) await assertClickable(page, id);
      const items = page.locator('[data-testid^="memorial.item."]');
      expect(await items.count()).toBeGreaterThan(6);
      await assertClickable(page, (await items.last().getAttribute('data-testid'))!, true);
      await page.getByTestId('memorial.close').click();

      // edict: a receipt with dozens of clauses
      await page.getByTestId('desk.edictScroll').click();
      await expect(page.getByTestId('edict.root')).toBeVisible();
      await panelSettled(page);
      await openBrush(page);
      for (const c of ['military', 'interior', 'diplomacy', 'other']) await page.getByTestId(`edict.section.${c}`).fill(LONG_EDICT);
      await assertClickable(page, 'edict.preview');
      await page.getByTestId('edict.preview').click();
      await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 20_000 });
      await panelSettled(page);
      expect(await page.locator('[data-testid^="edict.clause."]').count()).toBeGreaterThan(20);
      await assertHeaderVisible(page, 'edict.root');
      for (const id of ['edict.promulgate', 'edict.backToEdit', 'edict.close']) await assertClickable(page, id);
      await page.getByTestId('edict.promulgate').click();
      await expect(page.getByTestId('edict.advance')).toBeVisible({ timeout: 20_000 });
      await assertClickable(page, 'edict.advance');
      await page.getByTestId('edict.advance').click();

      // result: very many clauses, facts, battles, events and ledger lines
      await expect(page.getByTestId('result.root')).toBeVisible({ timeout: 30_000 });
      await panelSettled(page);
      expect(await page.locator('[data-testid^="result.clause."]').count()).toBeGreaterThan(20);
      expect(await page.locator('[data-testid^="result.battle."]').count()).toBeGreaterThan(5);
      await assertHeaderVisible(page, 'result.root');
      await assertScrolls(page, 'result.root');
      await assertClickable(page, 'result.next');
      await assertClickable(page, 'result.close');
      await page.getByTestId('result.next').click();
      await expect(page.getByTestId('result.root')).toHaveCount(0);
      await settle(page, 400);

      // pending choice (may already be open from the season's events)
      if (!(await page.getByTestId('choice.root').isVisible())) {
        await page.evaluate(() => {
          const id = JSON.parse(localStorage.getItem('tianbao.session') ?? 'null') as string;
          window.__tianbaoMock?.openChoice(id);
          window.dispatchEvent(new Event('tianbao:refresh'));
        });
      }
      await expect(page.getByTestId('choice.root')).toBeVisible();
      await panelSettled(page);
      await assertHeaderVisible(page, 'choice.root');
      for (const loc of await page.locator('[data-testid^="choice.option."]').all()) await assertClickable(page, (await loc.getAttribute('data-testid'))!, true);
      await assertClickable(page, 'choice.defer');
      await page.getByTestId('choice.defer').click();
      await expect(page.getByTestId('choice.root')).toHaveCount(0);

      // timeline with dozens of pages, advice library with dozens of entries, settings
      for (const [medallion, root, actions, header] of [
        ['desk.medallion.timeline', 'timeline.root', ['timeline.close', 'timeline.tab.saves'], undefined],
        ['desk.medallion.advice', 'advice.root', ['advice.close'], undefined],
        ['desk.medallion.settings', 'settings.root', ['settings.close', 'settings.save', 'settings.test'], undefined],
        ['desk.medallion.audience', 'audience.root', ['audience.close', 'audience.input', 'audience.adviceLibrary'], '.audience-roster'],
        ['desk.medallion.debate', 'debate.root', ['debate.close', 'debate.topic'], undefined],
        ['desk.memorialBook', 'command.root', ['command.close'], undefined],
        ['desk.replies', 'replies.root', ['replies.close', 'replies.toAdvice', 'replies.toAudience'], undefined],
      ] as const) {
        await page.getByTestId(medallion).click();
        if (root === 'command.root') {
          await page.getByTestId('memorial.command').click();
        }
        await expect(page.getByTestId(root)).toBeVisible();
        await panelSettled(page);
        if (root === 'audience.root') {
          // a long audience: the log scrolls, the input stays put
          for (let i = 0; i < 4; i++) {
            await page.getByTestId('audience.opener.0').click();
            await expect(page.getByTestId('audience.send')).toBeVisible({ timeout: 20_000 });
          }
        }
        await assertHeaderVisible(page, root, header);
        for (const id of actions) await assertClickable(page, id);
        if (root === 'timeline.root') await assertScrolls(page, root);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(root)).toHaveCount(0);
      }

      // ending screen with a long chronicle
      await page.evaluate(() => {
        const id = JSON.parse(localStorage.getItem('tianbao.session') ?? 'null') as string;
        window.__tianbaoMock?.forceOutcome(id, 'e1_zhongxing');
        window.dispatchEvent(new Event('tianbao:refresh'));
      });
      await expect(page.getByTestId('ending.root')).toBeVisible();
      await settle(page, 1500);
      for (const id of ['ending.newGame', 'ending.toTitle', 'ending.timeline']) await assertClickable(page, id);
      expect(errors).toEqual([]);
    });
  });
}
