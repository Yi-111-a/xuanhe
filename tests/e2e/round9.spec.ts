// Round 9 (CONTRACT §7) through the UI: agenda quotas and 回奏, debate presence and 书面议状,
// the structured edict (policy cards, 兵部 orders, per-clause receipt), memorial dating and the
// tutorial. Runs in mock mode and, with E2E_API_BASE set, against the real engine.
// `@iter4` also saves review screenshots to playtests/screens/iter4/.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openBrush, REAL, settle, skipTutorial, startGame, watchErrors } from './helpers';

const SHOTS = path.resolve(__dirname, '..', '..', 'playtests', 'screens', 'iter4');
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const vp = page.viewportSize()!;
  await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.width}x${vp.height}${REAL ? '-real' : ''}.png`) });
};

async function advance(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.getByTestId('choice.root').isVisible().catch(() => false)) await page.getByTestId('choice.defer').click();
  await page.getByTestId('desk.advance').click();
  if (await page.getByTestId('desk.advance.confirm').isVisible().catch(() => false)) await page.getByTestId('desk.advance.confirm').click();
  await expect(page.getByTestId('result.root').or(page.getByTestId('ending.root'))).toBeVisible({ timeout: 90_000 });
  if (await page.getByTestId('result.root').isVisible()) {
    await page.getByTestId('result.next').click();
    await expect(page.getByTestId('result.root')).toHaveCount(0);
  }
  await settle(page, 600);
  if (await page.getByTestId('choice.root').isVisible().catch(() => false)) await page.getByTestId('choice.defer').click();
}

/** Picks the first real option of a <select> (skipping the 「— 择… —」 placeholder). */
async function pickFirst(page: Page, testid: string, last = false) {
  const sel = page.getByTestId(testid);
  const values = await sel.locator('option:not([disabled])').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  expect(values.length, `${testid} has options`).toBeGreaterThan(0);
  await sel.selectOption(last ? values[values.length - 1] : values[0]);
}

async function openAudience(page: Page) {
  await page.getByTestId('desk.medallion.audience').click();
  await expect(page.getByTestId('audience.root')).toBeVisible();
  await expect(page.locator('.roster-group').first()).toBeVisible({ timeout: 15_000 });
  await settle(page, 500);
}

test('agenda quota, 遣使问对 and the 回奏 box @round9', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await startGame(page);
  await expect(page.getByTestId('desk.medallion.audience.count')).toHaveText(/^0\/\d+$/);
  await expect(page.getByTestId('desk.medallion.debate.count')).toHaveText(/^0\/\d+$/);

  // an absent minister: the envoy leaves, the answer comes next season
  await openAudience(page);
  const away = page.locator('.roster-chip.is-away').first();
  await expect(away).toBeVisible();
  const awayId = (await away.getAttribute('data-testid'))!.slice('audience.pick.'.length);
  await away.click();
  await expect(page.getByTestId('audience.notice')).toContainText('下季');
  await page.getByTestId('audience.opener.0').click();
  await expect(page.locator('.msg--system').last()).toContainText('使者已发', { timeout: 30_000 });
  await expect(page.getByTestId('audience.agenda')).toContainText('1/');
  // use up the quota on ministers in the capital
  const limit = Number((await page.getByTestId('audience.agenda').innerText()).match(/1\/(\d+)/)![1]);
  const here = page.locator('.roster-chip:not(.is-away)');
  for (let i = 1; i < limit; i++) {
    await here.nth(i).click();
    await page.getByTestId('audience.opener.1').click();
    await expect(page.getByTestId('audience.send')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('audience.agenda')).toContainText(`${i + 1}/${limit}`, { timeout: 15_000 });
  }
  await expect(page.getByTestId('audience.opener.0')).toBeDisabled();
  await expect(page.getByTestId('audience.notice')).toContainText('已满');
  await page.keyboard.press('Escape');
  const medal = page.getByTestId('desk.medallion.audience');
  await expect(medal).toHaveClass(/is-exhausted/);
  await expect(medal).toHaveAttribute('title', /已满/);

  // next season: the 回奏 arrives in the box on the desk
  await advance(page);
  await expect(page.getByTestId('desk.medallion.audience.count')).toHaveText(/^0\//);
  await expect(page.getByTestId('desk.replies').locator('.object-badge')).toHaveText('1');
  await page.getByTestId('desk.replies').click();
  await expect(page.getByTestId('replies.root')).toBeVisible();
  await expect(page.getByTestId('replies.item.0')).toBeVisible();
  await expect(page.getByTestId('replies.item.0')).not.toHaveText(/回奏未至/);
  expect(await page.getByTestId('replies.item.0').locator('img, svg').count()).toBeGreaterThan(0);
  await settle(page, 600);
  await shot(page, 'replies');
  await page.getByTestId('replies.close').click();
  await expect(page.getByTestId('desk.replies').locator('.object-badge')).toHaveCount(0);
  expect(awayId).toBeTruthy();
  expect(errors).toEqual([]);
});

test('court debate: only ministers in the capital, others send 书面议状 @round9', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await startGame(page);
  await page.getByTestId('desk.medallion.debate').click();
  await expect(page.getByTestId('debate.root')).toBeVisible();
  const toggle = page.locator('[data-testid^="debate.written."]').first();
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  const awayId = (await toggle.getAttribute('data-testid'))!.slice('debate.written.'.length);
  await expect(page.getByTestId(`debate.pick.${awayId}`)).toBeDisabled();
  await expect(page.getByTestId(`debate.pick.${awayId}`)).toContainText('不在京');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('debate.topicChip.0').click();
  await settle(page, 400);
  await shot(page, 'debate-picker');
  await page.getByTestId('debate.start').click();
  await expect(page.getByTestId('debate.writtenLine')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('debate.writtenLine')).toContainText('下季');
  await page.getByTestId('debate.skip').click().catch(() => undefined);
  await expect(page.getByTestId('debate.again')).toBeDisabled({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('desk.medallion.debate')).toHaveClass(/is-exhausted/);

  // next season the 书面议状 is in the 谏言库, with its source
  await advance(page);
  await page.getByTestId('desk.medallion.advice').click();
  await expect(page.getByTestId('advice.root')).toBeVisible();
  await expect(page.locator('[data-testid^="advice.source."]').filter({ hasText: '书面议状' }).first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('structured edict: policy cards and 兵部 orders, receipt per clause @round9', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await startGame(page);

  // 兵部: pick an army with a commander in camp, order it to march; the route is drawn on the map
  await page.getByTestId('desk.medallion.army').click();
  await expect(page.getByTestId('army.root')).toBeVisible();
  const withCmd = page.locator('[data-testid^="army.item."]').filter({ hasText: '在营' });
  await expect(withCmd.first()).toBeVisible({ timeout: 20_000 });
  await withCmd.first().click();
  await expect(page.getByTestId('army.order.march')).toBeEnabled();
  await page.getByTestId('army.order.march').click();
  await pickFirst(page, 'army.target');
  await expect(page.getByTestId('map.armyRoute')).toBeVisible();
  expect(await page.locator('[data-testid^="map.eta."]').count()).toBeGreaterThan(5);
  await page.getByTestId('army.addOrder').click();
  await expect(page.locator('[data-testid$=".remove"][data-testid^="army.draft."]')).toHaveCount(1);
  await page.getByTestId('army.toEdict').click();
  await expect(page.getByTestId('edict.root')).toBeVisible();
  await expect(page.locator('[data-testid^="edict.card."][data-card="mil_march"]')).toHaveCount(1);

  // a 内政 card aimed at a far region: 赈济 安西 → 驿程遥远，令达于下季
  await page.getByTestId('edict.cardAdd').click();
  await expect(page.getByTestId('edict.cardPicker')).toBeVisible();
  const cat = page.getByTestId('edict.cardCat.内政');
  if (await cat.isEnabled()) await cat.click();
  await page.getByTestId('edict.cardPick.int_relief').click();
  await expect(page.getByTestId('edict.cardPicker')).toHaveCount(0);
  const relief = page.locator('[data-testid^="edict.card."][data-card="int_relief"]');
  const idx = (await relief.getAttribute('data-testid'))!.split('.')[2];
  await expect(page.getByTestId('edict.preview')).toBeDisabled(); // a parameter is still missing
  await page.getByTestId(`edict.card.${idx}.param.region`).selectOption('anxi');
  // the free text stays folded away until asked for, with the offline notice
  await expect(page.getByTestId('edict.section.military')).toHaveCount(0);
  await expect(page.getByTestId('edict.brushNote')).toBeVisible();
  await settle(page, 500);
  await shot(page, 'edict-cards');
  await page.getByTestId('edict.preview').click();
  await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 60_000 });
  const cards = page.locator('[data-testid^="edict.clause."][data-source="card"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-testid$=".delay"]').filter({ hasText: '驿程遥远' }).first()).toBeVisible();
  await expect(page.locator('[data-testid^="edict.clause."][data-testid$=".risk"]').first()).toBeVisible();
  await settle(page, 600);
  await shot(page, 'edict-receipt');
  await page.getByTestId('edict.promulgate').click();
  await expect(page.getByTestId('edict.advance')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('memorials carry their courier date @round9', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  await page.getByTestId('desk.memorialBook').click();
  await expect(page.getByTestId('memorial.root')).toBeVisible();
  const first = page.locator('[data-testid^="memorial.arrival."]').first();
  await expect(first).toHaveText(/月.{1,3}日自.+奏到|迟到之报/);
  await expect(page.getByTestId('memorial.dateline')).toContainText('奏到');
  expect(errors).toEqual([]);
});

test('tutorial: ring on the target, 下一步 / 跳过引导, settings switch @tutorial', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await startGame(page, { keepTutorial: true });
  const root = page.getByTestId('tutorial.root');
  await expect(root).toBeVisible();
  await expect(root).toHaveAttribute('data-target', 'desk.memorialBook');
  const ringAround = async (testid: string) => {
    const ring = (await page.getByTestId('tutorial.ring').boundingBox())!;
    const box = (await page.getByTestId(testid).first().boundingBox())!;
    return ring.x <= box.x + 1 && ring.y <= box.y + 1 && ring.x + ring.width >= box.x + box.width - 1 && ring.y + ring.height >= box.y + box.height - 1;
  };
  await expect.poll(() => ringAround('desk.memorialBook')).toBe(true);
  await shot(page, 'tutorial-desk');
  // clicking the highlighted control moves on; inside the panel the ring finds the memorial
  await page.getByTestId('desk.memorialBook').click();
  await expect(root).toHaveAttribute('data-target', 'memorial.item.t0_hedong');
  await expect.poll(() => ringAround('memorial.item.t0_hedong'), { timeout: 10_000 }).toBe(true);
  await settle(page, 900);
  await shot(page, 'tutorial-memorial');
  await page.getByTestId('tutorial.next').click();
  await expect(root).toHaveAttribute('data-target', 'memorial.option.t0_hedong.*');
  // the note never blocks the page: the highlighted option is still clickable
  const option = page.locator('[data-testid^="memorial.option.t0_hedong."]').first();
  await option.click();
  await expect(root).toHaveAttribute('data-target', 'desk.edictScroll');
  await expect(page.locator('.tut-hint')).toContainText('收起');
  await page.getByTestId('tutorial.skip').click();
  await expect(root).toHaveCount(0, { timeout: 15_000 });
  await page.keyboard.press('Escape');
  // settings › 对局: switch it back on
  await page.getByTestId('desk.medallion.settings').click();
  await page.getByTestId('settings.tab.game').click();
  const sw = page.getByTestId('settings.tutorial');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(root).toBeVisible();
  await skipTutorial(page);
  expect(errors).toEqual([]);
});

for (const size of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    test('review screenshots of the round-9 screens @iter4', async ({ page }) => {
      test.setTimeout(300_000);
      const errors = watchErrors(page);
      await startGame(page, { keepTutorial: true });
      await expect(page.getByTestId('tutorial.ring')).toBeVisible();
      await settle(page, 900);
      await shot(page, 'tutorial');
      await skipTutorial(page);
      // 兵部 with a route on the map
      await page.getByTestId('desk.medallion.army').click();
      const withCmd = page.locator('[data-testid^="army.item."]').filter({ hasText: '在营' });
      await expect(withCmd.first()).toBeVisible({ timeout: 20_000 });
      await withCmd.last().click();
      await page.getByTestId('army.order.march').click();
      await pickFirst(page, 'army.target', true);
      await settle(page, 1200);
      await shot(page, 'army');
      await page.getByTestId('army.addOrder').click();
      await page.getByTestId('army.toEdict').click();
      await expect(page.getByTestId('edict.root')).toBeVisible();
      await page.getByTestId('edict.cardAdd').click();
      await settle(page, 900);
      await shot(page, 'edict-picker');
      await page.getByTestId('edict.cardCat.内政').click();
      await page.getByTestId('edict.cardPick.int_walls').click();
      await pickFirst(page, `edict.card.1.param.region`);
      await openBrush(page);
      await page.getByTestId('edict.section.military').fill('命潼关增修关防。');
      await settle(page, 700);
      await shot(page, 'edict');
      await page.getByTestId('edict.preview').click();
      await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 60_000 });
      await settle(page, 1500);
      await shot(page, 'edict-receipt');
      await page.keyboard.press('Escape');
      // audience with presence and agenda
      await openAudience(page);
      await page.locator('.roster-chip.is-away').first().click();
      await page.getByTestId('audience.opener.0').click();
      await expect(page.locator('.msg--system').last()).toContainText('使者已发', { timeout: 30_000 });
      await settle(page, 600);
      await shot(page, 'audience');
      await page.keyboard.press('Escape');
      await settle(page, 400);
      await shot(page, 'desk-agenda');
      // debate picker
      await page.getByTestId('desk.medallion.debate').click();
      await page.locator('[data-testid^="debate.written."]').first().click();
      await page.getByTestId('debate.topicChip.0').click();
      await settle(page, 600);
      await shot(page, 'debate');
      await page.keyboard.press('Escape');
      // memorial dating
      await page.getByTestId('desk.memorialBook').click();
      await settle(page, 1200);
      await shot(page, 'memorial');
      expect(errors).toEqual([]);
    });
  });
}
