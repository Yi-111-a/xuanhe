// G5 GUI playthrough: plays a whole game through the real UI against a running engine
// (E2E_API_BASE), adopting one option per memorial each season (PLAYTHROUGH_PICK=first|last),
// until the ending screen. Round 9: every other season it also adds a policy card to the edict,
// every third season it gives an army an order from the 兵部 (it goes into the edict, not straight
// into effect), and it holds audiences and a court debate within the season's agenda — checking
// that the quota shown on the desk is never exceeded and that a used-up quota closes the panel.
// Every season it checks that the result scroll's 「下一季」 is really clickable and that no raw
// entity id is shown. Screenshots of every season's result scroll land in playtests/screens/playthrough/.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { REAL, settle, startGame, watchErrors } from './helpers';

const SHOTS = path.resolve(__dirname, '..', '..', 'playtests', 'screens', 'playthrough');
const MAX_SEASONS = 30;
const ID_TOKEN = /\b(tang|yan|tubo|nanzhao|khitan_xi|dashi|huihe)\b|[a-z]+_[a-z0-9_]+/;
/** cards the playthrough is willing to issue (no dismissals or arrests: it plays a steady hand) */
const CARD_PREFS = ['int_relief', 'int_walls', 'fin_hedi', 'fin_changping', 'mil_tuanjie', 'int_remit', 'fin_tuntian', 'dip_hushi', 'int_canal'];

test.skip(!REAL, 'needs a real engine (E2E_API_BASE)');
test.setTimeout(60 * 60_000);

const visible = (page: Page, id: string) => page.getByTestId(id).isVisible().catch(() => false);

/** Resolves any pending event choice (modal or the deferred badge on the desk). */
async function settleChoices(page: Page, pick: 'first' | 'last') {
  for (let guard = 0; guard < 6; guard++) {
    if (!(await visible(page, 'choice.root')) && (await visible(page, 'desk.choiceBadge'))) {
      await page.getByTestId('desk.choiceBadge').click();
      await expect(page.getByTestId('choice.root')).toBeVisible();
    }
    if (!(await visible(page, 'choice.root'))) return;
    await settle(page, 400);
    const options = page.locator('[data-testid^="choice.option."]:enabled');
    await expect(options.first()).toBeVisible();
    const title = (await page.locator('[data-testid="choice.root"] .choice-title').innerText()).trim();
    await (pick === 'last' ? options.last() : options.first()).click();
    // several choices can be pending in one season: the modal then moves on to the next one
    await expect
      .poll(
        async () =>
          (await page.getByTestId('choice.root').count()) === 0 ||
          (await page.locator('[data-testid="choice.root"] .choice-title').innerText().catch(() => '')).trim() !== title,
        { timeout: 20_000 },
      )
      .toBe(true);
    await settle(page, 400);
  }
}

/** The element is on screen and is what a click at its centre would hit. */
async function clickable(page: Page, testid: string): Promise<string> {
  return page.getByTestId(testid).evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight || r.right > innerWidth || r.top < 0 || r.left < 0) return 'outside viewport';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && (hit === el || el.contains(hit)) ? 'ok' : `covered by ${hit?.className}`;
  });
}

/** 「a/b」 from a medallion's agenda counter; never over the quota. */
async function agenda(page: Page, kind: 'audience' | 'debate'): Promise<{ used: number; limit: number } | null> {
  const el = page.getByTestId(`desk.medallion.${kind}.count`);
  if (!(await el.isVisible().catch(() => false))) return null;
  const m = (await el.innerText()).match(/(\d+)\/(\d+)/);
  if (!m) return null;
  const v = { used: Number(m[1]), limit: Number(m[2]) };
  expect(v.used, `${kind} agenda within its quota`).toBeLessThanOrEqual(v.limit);
  return v;
}

async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('.overlay, [data-testid="army.root"]').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

/** One audience with a minister in the capital, if the quota allows; a full quota closes the panel. */
async function holdAudience(page: Page, season: number) {
  const before = await agenda(page, 'audience');
  await page.getByTestId('desk.medallion.audience').click();
  await expect(page.getByTestId('audience.root')).toBeVisible();
  await expect(page.locator('.roster-group').first()).toBeVisible({ timeout: 20_000 });
  if (before && before.used >= before.limit) {
    await expect(page.getByTestId('audience.opener.0')).toBeDisabled();
  } else {
    const chips = page.locator('.roster-chip:not(.is-away):enabled');
    if ((await chips.count()) > 0) await chips.nth(season % (await chips.count())).click();
    await page.getByTestId('audience.opener.2').click();
    await expect(page.getByTestId('audience.send')).toBeVisible({ timeout: 90_000 });
    if (before) await expect(page.getByTestId('audience.agenda')).toContainText(`${before.used + 1}/${before.limit}`, { timeout: 20_000 });
  }
  await closeOverlays(page);
}

/** A court debate on the first memorial, ministers in the capital only, if the quota allows. */
async function holdDebate(page: Page) {
  const before = await agenda(page, 'debate');
  await page.getByTestId('desk.medallion.debate').click();
  await expect(page.getByTestId('debate.root')).toBeVisible();
  await settle(page, 600);
  const start = page.getByTestId('debate.start');
  if (!(await start.isVisible().catch(() => false))) {
    // this season's debate is shown again: no second one
    await expect(page.getByTestId('debate.again')).toBeDisabled();
    await closeOverlays(page);
    return;
  }
  if (before && before.used >= before.limit) {
    await expect(start).toBeDisabled();
    await closeOverlays(page);
    return;
  }
  const chip = page.getByTestId('debate.topicChip.0');
  if (await chip.isVisible().catch(() => false)) await chip.click();
  else await page.getByTestId('debate.topic').fill('边事当如何处置？');
  const picked = page.locator('.debate-pick.is-on');
  const here = page.locator('.debate-pick:not(.is-absent):not(.is-on):enabled');
  while ((await picked.count()) < 2 && (await here.count()) > 0) await here.first().click();
  if (await start.isEnabled()) {
    await start.click();
    await expect(page.getByTestId('debate.topicLine')).toBeVisible({ timeout: 120_000 });
    // the engine's proposition carries option ids for model clients; the desk shows none of them
    await expect(page.getByTestId('debate.topicLine')).not.toContainText(/`|某|[A-Za-z_]{3,}/);
    await expect(page.getByTestId('desk.medallion.debate')).toHaveClass(/is-exhausted/, { timeout: 20_000 });
  }
  await closeOverlays(page);
}

/** An order from the 兵部: posture for one army (hold, else attack). It lands in the edict draft. */
async function armyOrder(page: Page, season: number, pick: 'first' | 'last') {
  await page.getByTestId('desk.medallion.army').click();
  await expect(page.getByTestId('army.root')).toBeVisible();
  const items = page.locator('[data-testid^="army.item."]');
  await expect(items.first()).toBeVisible({ timeout: 20_000 });
  const n = await items.count();
  const drafted = page.locator('[data-testid^="army.draft."]');
  for (let k = 0; k < n && (await drafted.count()) === 0; k++) {
    const item = items.nth((season + k + (pick === 'last' ? 3 : 0)) % n);
    if (await item.isEnabled()) await item.click(); // the selected army is rendered disabled
    await settle(page, 250);
    for (const id of ['army.posture.hold', 'army.posture.attack']) {
      const b = page.getByTestId(id);
      if (await b.isEnabled().catch(() => false)) {
        await b.click();
        break;
      }
    }
  }
  expect(await drafted.count(), 'an army order went into the draft').toBeGreaterThan(0);
  await closeOverlays(page);
}

/** One policy card from the picker, parameters filled from the offered options. */
async function addCard(page: Page, season: number, pick: 'first' | 'last'): Promise<boolean> {
  const before = await page.locator('[data-testid^="edict.card."][data-card]').count();
  await page.getByTestId('edict.cardAdd').click();
  await expect(page.getByTestId('edict.cardPicker')).toBeVisible();
  await expect(page.locator('[data-testid^="edict.cardPick."]').first()).toBeVisible({ timeout: 20_000 });
  let chosen = false;
  for (const cat of ['内政', '财计', '军务', '外交']) {
    const tab = page.getByTestId(`edict.cardCat.${cat}`);
    if (!(await tab.isVisible().catch(() => false))) continue;
    if (await tab.isEnabled()) await tab.click();
    const order = season % 2 ? [...CARD_PREFS].reverse() : CARD_PREFS;
    for (const id of order) {
      const card = page.getByTestId(`edict.cardPick.${id}`);
      if ((await card.count()) && (await card.isEnabled())) {
        await card.click();
        chosen = true;
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    await page.getByTestId('edict.cardPickerClose').click();
    return false;
  }
  await expect(page.locator('[data-testid^="edict.card."][data-card]')).toHaveCount(before + 1);
  const idx = before;
  const params = page.locator(`[data-testid^="edict.card.${idx}.param."]`);
  for (let i = 0; i < (await params.count()); i++) {
    const p = params.nth(i);
    if ((await p.evaluate((e) => e.tagName)) !== 'SELECT' || (await p.inputValue())) continue;
    const values = await p.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    if (values.length) await p.selectOption(pick === 'last' ? values[values.length - 1] : values[season % values.length]);
  }
  return true;
}

test('a full game can be played through the UI to an ending @playthrough', async ({ page }) => {
  const errors = watchErrors(page);
  const pick = process.env.PLAYTHROUGH_PICK === 'last' ? 'last' : 'first';
  fs.mkdirSync(SHOTS, { recursive: true });
  await startGame(page);
  const tally = { cards: 0, orders: 0, audiences: 0, debates: 0 };

  for (let season = 0; season < MAX_SEASONS; season += 1) {
    if (await visible(page, 'ending.root')) break;
    await settleChoices(page, pick);

    // court business within the season's agenda
    if (season % 3 === 2) {
      await holdAudience(page, season);
      tally.audiences += 1;
    }
    if (season % 4 === 1) {
      await holdDebate(page);
      tally.debates += 1;
    }
    await settleChoices(page, pick);
    if (season % 3 === 0) {
      await armyOrder(page, season, pick);
      tally.orders += 1;
    }

    // Read the memorials and adopt one option per item.
    await page.getByTestId('desk.memorialBook').click();
    await expect(page.getByTestId('memorial.root')).toBeVisible();
    await settle(page, 700);
    const items = page.locator('[data-testid^="memorial.item."]');
    const count = await items.count();
    for (let i = 0; i < count; i += 1) {
      const item = items.nth(i);
      const itemId = (await item.getAttribute('data-testid'))!.slice('memorial.item.'.length);
      if (await item.isEnabled()) await item.click(); // the selected item is rendered disabled
      await expect(page.locator(`[data-testid="memorial.arrival.${itemId}"]`)).toHaveText(/奏到|迟到之报/);
      const options = page.locator(`[data-testid^="memorial.option.${itemId}."]`);
      await expect(options.first()).toBeVisible();
      await (pick === 'last' ? options.last() : options.first()).click();
    }
    expect(await clickable(page, 'memorial.toEdict'), 'memorial.toEdict').toBe('ok');
    await page.getByTestId('memorial.toEdict').click();
    await expect(page.getByTestId('edict.root')).toBeVisible();
    await settle(page, 800);
    if (season % 2 === 0 && (await addCard(page, season, pick))) tally.cards += 1;

    const preview = page.getByTestId('edict.preview');
    if (await preview.isEnabled()) {
      await preview.click();
      await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 90_000 });
      const shown = await page.getByTestId('edict.receipt').innerText();
      expect(shown.match(ID_TOKEN)?.[0] ?? null, `raw id on the receipt (season ${season + 1})`).toBeNull();
      await page.getByTestId('edict.promulgate').click();
      await expect(page.getByTestId('edict.advance')).toBeVisible({ timeout: 90_000 });
      await page.getByTestId('edict.advance').click();
    } else {
      await closeOverlays(page);
      await page.getByTestId('desk.advance').click();
      if (await visible(page, 'desk.advance.confirm')) await page.getByTestId('desk.advance.confirm').click();
    }

    // Result scroll (or the ending screen if the season ended the game).
    const result = page.getByTestId('result.root');
    const ending = page.getByTestId('ending.root');
    await expect(result.or(ending)).toBeVisible({ timeout: 180_000 });
    await settle(page, 1200);
    await page.screenshot({ path: path.join(SHOTS, `${pick}-season-${String(season + 1).padStart(2, '0')}.png`) });
    if (await result.isVisible()) {
      const shown = await result.innerText();
      expect(shown.match(ID_TOKEN)?.[0] ?? null, `raw id on the result scroll (season ${season + 1})`).toBeNull();
      await expect(page.getByTestId('result.figure').or(page.locator('.result--no-figure'))).toBeVisible();
      await expect(page.locator('.result-figure.is-pending'), 'illustration decided').toHaveCount(0, { timeout: 15_000 });
      expect(await clickable(page, 'result.next'), `result.next clickable (season ${season + 1})`).toBe('ok');
      await page.getByTestId('result.next').click();
      await expect(result).toHaveCount(0);
      // a new season: the agenda is reset
      const a = await agenda(page, 'audience');
      if (a) expect(a.used, 'audience agenda reset at settlement').toBe(0);
    }
    await settle(page, 500);
  }

  await expect(page.getByTestId('ending.root')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ending.title')).not.toBeEmpty();
  await settle(page, 1500);
  const title = (await page.getByTestId('ending.title').innerText()).trim();
  test.info().annotations.push({ type: 'ending', description: `${pick}: ${title}` });
  test.info().annotations.push({ type: 'round9', description: JSON.stringify(tally) });
  console.log(`[playthrough ${pick}] ending: ${title}; ${JSON.stringify(tally)}`);
  expect(tally.cards).toBeGreaterThan(0);
  expect(tally.orders).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(SHOTS, `${pick}-ending.png`) });
  expect(errors).toEqual([]);
});
