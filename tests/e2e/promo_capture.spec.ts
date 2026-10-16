// Promo footage: screenshots and screen recordings of the real game for the promo video
// (videos/tianbao-promo). Not part of the regular suites: runs only with PROMO_CAPTURE=1 and a real
// engine, e.g.
//   PROMO_CAPTURE=1 PROMO_REBEL=<session id> PROMO_GOOD=<session id> E2E_API_BASE=http://127.0.0.1:8765 E2E_PORT=5176 \
//     npx playwright test promo_capture --grep @promo
// PROMO_REBEL is a save one season before 范阳起兵, PROMO_GOOD a save one season before a good ending.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { REAL, settle } from './helpers';

const OUT = path.resolve(__dirname, '..', '..', 'videos', 'tianbao-promo', 'capture', 'assets');
const CLIPS = path.resolve(__dirname, '..', '..', 'videos', 'tianbao-promo', 'capture', 'clips');
const SIZE = { width: 1920, height: 1080 };

test.skip(!REAL || !process.env.PROMO_CAPTURE, 'promo capture only (PROMO_CAPTURE=1 with a real engine)');
test.setTimeout(30 * 60_000);
test.use({ reducedMotion: 'no-preference' });

async function recorder(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const base = test.info().project.use.baseURL;
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    baseURL: base,
    reducedMotion: 'no-preference',
    recordVideo: { dir: CLIPS, size: SIZE },
  });
  return { context, page: await context.newPage() };
}

async function finish(context: BrowserContext, page: Page, name: string) {
  const video = page.video();
  await context.close();
  if (video) fs.renameSync(await video.path(), path.join(CLIPS, `${name}.webm`));
}

async function shot(page: Page, name: string, wait = 900) {
  // the result scroll's illustration loads after the scroll opens; do not shoot the empty frame
  const art = page.locator('[data-testid="result.figure"] .event-art[data-art="image"] img');
  if (await art.count()) await expect(art.first()).toHaveClass(/is-loaded/, { timeout: 15_000 }).catch(() => undefined);
  await settle(page, wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('.overlay, [data-testid="army.root"]').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function skipTutorial(page: Page) {
  const skip = page.getByTestId('tutorial.skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(300);
  // the 「引导已关闭」 toast must not sit in the screenshots
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined);
}

/** Opens a saved game from the title screen's 「继续」. */
async function resume(page: Page, sessionId: string) {
  await page.goto('/');
  await page.evaluate((id) => {
    localStorage.clear();
    localStorage.setItem('tianbao.session', JSON.stringify(id));
    localStorage.setItem('tianbao.tutorial', JSON.stringify({ done: true }));
  }, sessionId);
  await page.goto('/');
  await expect(page.getByTestId('title.continue')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('title.continue').click();
  await expect(page.getByTestId('desk.root')).toBeVisible({ timeout: 30_000 });
  await skipTutorial(page);
}

/** Advance the season straight from the desk (no edict). */
async function advance(page: Page) {
  await closeOverlays(page);
  await page.getByTestId('desk.advance').click();
  const confirm = page.getByTestId('desk.advance.confirm');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await expect(page.getByTestId('result.root').or(page.getByTestId('ending.root'))).toBeVisible({ timeout: 180_000 });
}

const ended = (page: Page) => page.getByTestId('ending.root').isVisible().catch(() => false);

async function scrollResult(page: Page) {
  const body = page.locator('[data-testid="result.root"] .result-body, [data-testid="result.root"] .scroll-body').first();
  if (await body.isVisible().catch(() => false)) {
    for (let i = 0; i < 6; i++) {
      await body.hover();
      await page.mouse.wheel(0, 260);
      await page.waitForTimeout(450);
    }
  }
}

/** 「下一季」 on the result scroll; a season that ended the game goes on to the ending screen. */
async function nextFromResult(page: Page) {
  await page.getByTestId('result.next').click();
  await expect(page.getByTestId('result.root')).toHaveCount(0, { timeout: 20_000 });
  await settle(page, 600);
}

async function chooseAll(page: Page, shotName?: string) {
  for (let guard = 0; guard < 5; guard++) {
    if (!(await page.getByTestId('choice.root').isVisible().catch(() => false))) {
      const badge = page.getByTestId('desk.choiceBadge');
      if (!(await badge.isVisible().catch(() => false))) return;
      await badge.click();
    }
    await expect(page.getByTestId('choice.root')).toBeVisible();
    if (shotName && guard === 0) await shot(page, shotName, 1400);
    const options = page.locator('[data-testid^="choice.option."]:enabled');
    await options.first().click();
    await page.waitForTimeout(1200);
  }
}

test('opening season: title, desk, memorials, audience, debate, edict, 兵部, result @promo', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CLIPS, { recursive: true });
  const { context, page } = await recorder(browser);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('title.root')).toBeVisible();
  // until the engine answers, the title shows its vector stand-in instead of the painting
  await expect(page.getByTestId('title.health')).toContainText('就绪', { timeout: 60_000 });
  await page.waitForFunction(() => [...document.images].some((i) => i.complete && i.naturalWidth > 1000), null, { timeout: 30_000 });
  await shot(page, '01-title', 2600);

  await page.getByTestId('title.newGame').click();
  await expect(page.getByTestId('newgame.root')).toBeVisible();
  await shot(page, '02-newgame', 1500);
  await page.getByTestId('newgame.start').click();
  await expect(page.getByTestId('desk.root')).toBeVisible({ timeout: 30_000 });
  await settle(page, 1500);
  await shot(page, '03-desk-tutorial', 400);
  await skipTutorial(page);
  await chooseAll(page);
  await shot(page, '04-desk', 1200);

  // the map: wheel zoom toward 范阳, drag, reset
  const stage = page.getByTestId('map.root');
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.3);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(160);
  }
  await shot(page, '05-map-zoom', 800);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45, { steps: 20 });
  await page.mouse.up();
  await page.getByTestId('map.zoomReset').click();
  await settle(page, 700);

  // 奏疏
  await page.getByTestId('desk.memorialBook').click();
  await expect(page.getByTestId('memorial.root')).toBeVisible();
  const items = page.locator('[data-testid^="memorial.item."]');
  await expect(items.first()).toBeVisible();
  const anItem = page.getByTestId('memorial.item.p_an_in_capital');
  if (await anItem.isVisible().catch(() => false)) await anItem.click();
  await shot(page, '06-memorial', 1200);
  await closeOverlays(page);

  // 召对安禄山
  await page.getByTestId('desk.medallion.audience').click();
  await expect(page.getByTestId('audience.root')).toBeVisible();
  await expect(page.locator('.roster-group').first()).toBeVisible({ timeout: 20_000 });
  const an = page.getByTestId('audience.pick.an_lushan');
  if (await an.isEnabled().catch(() => false)) await an.click();
  await settle(page, 600);
  await page.getByTestId('audience.opener.0').click();
  await expect(page.getByTestId('audience.send')).toBeVisible({ timeout: 120_000 });
  await shot(page, '07-audience', 1500);
  await closeOverlays(page);

  // 廷议
  await page.getByTestId('desk.medallion.debate').click();
  await expect(page.getByTestId('debate.root')).toBeVisible();
  await settle(page, 700);
  const chip = page.getByTestId('debate.topicChip.0');
  if (await chip.isVisible().catch(() => false)) await chip.click();
  const here = page.locator('.debate-pick:not(.is-absent):not(.is-on):enabled');
  while ((await page.locator('.debate-pick.is-on').count()) < 3 && (await here.count()) > 0) await here.first().click();
  await shot(page, '08-debate-setup', 600);
  await page.getByTestId('debate.start').click();
  await expect(page.getByTestId('debate.topicLine')).toBeVisible({ timeout: 120_000 });
  await settle(page, 2500);
  await shot(page, '09-debate', 600);
  await closeOverlays(page);

  // 兵部
  await page.getByTestId('desk.medallion.army').click();
  await expect(page.getByTestId('army.root')).toBeVisible();
  const armies = page.locator('[data-testid^="army.item."]');
  await expect(armies.first()).toBeVisible({ timeout: 20_000 });
  if ((await armies.count()) > 1 && (await armies.nth(1).isEnabled())) await armies.nth(1).click();
  await shot(page, '10-army', 1200);
  await closeOverlays(page);

  // 奏疏 → 拟诏（采纳留京夺镇；加一张政策卡）
  await page.getByTestId('desk.memorialBook').click();
  await expect(page.getByTestId('memorial.root')).toBeVisible();
  await settle(page, 600);
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const id = (await item.getAttribute('data-testid'))!.slice('memorial.item.'.length);
    if (await item.isEnabled()) await item.click();
    const wanted = page.getByTestId(`memorial.option.${id}.detain_guo`);
    const options = page.locator(`[data-testid^="memorial.option.${id}."]`);
    await expect(options.first()).toBeVisible();
    if (await wanted.isVisible().catch(() => false)) await wanted.click();
    else await options.first().click();
  }
  await page.getByTestId('memorial.toEdict').click();
  await expect(page.getByTestId('edict.root')).toBeVisible();
  await settle(page, 900);
  await page.getByTestId('edict.cardAdd').click();
  await expect(page.getByTestId('edict.cardPicker')).toBeVisible();
  await expect(page.locator('[data-testid^="edict.cardPick."]').first()).toBeVisible({ timeout: 20_000 });
  await shot(page, '11-cards', 900);
  const relief = page.getByTestId('edict.cardPick.int_relief');
  if (await relief.isEnabled().catch(() => false)) await relief.click();
  else await page.locator('[data-testid^="edict.cardPick."]:enabled').first().click();
  const params = page.locator('[data-testid^="edict.card.0.param."]');
  for (let i = 0; i < (await params.count()); i++) {
    const p = params.nth(i);
    if ((await p.evaluate((e) => e.tagName)) !== 'SELECT' || (await p.inputValue())) continue;
    const values = await p.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    if (values.length) await p.selectOption(values[0]);
  }
  await shot(page, '12-edict', 900);
  await page.getByTestId('edict.preview').click();
  await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 120_000 });
  await shot(page, '13-receipt', 1200);
  await page.getByTestId('edict.promulgate').click();
  await expect(page.getByTestId('edict.advance')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('edict.advance').click();
  await expect(page.getByTestId('result.root')).toBeVisible({ timeout: 180_000 });
  await shot(page, '14-result', 2200);
  await scrollResult(page);
  await shot(page, '15-result-ledger', 600);
  await finish(context, page, 'a-opening');
});

test('rebellion: 范阳起兵 to the bad ending @promo', async ({ browser }) => {
  const sid = process.env.PROMO_REBEL;
  test.skip(!sid, 'PROMO_REBEL not set');
  const { context, page } = await recorder(browser);
  await resume(page, sid!);
  await chooseAll(page);
  await shot(page, '20-desk-before', 1500);
  await page.getByTestId('desk.crisis').click().catch(() => undefined);
  await shot(page, '21-crisis', 900);
  await closeOverlays(page);
  await page.keyboard.press('Escape');
  for (let season = 0; season < 8 && !(await ended(page)); season++) {
    await advance(page);
    if (await ended(page)) break;
    await shot(page, `22-war-result-${season}`, 2400);
    await scrollResult(page);
    await nextFromResult(page);
    if (await ended(page)) break;
    await chooseAll(page, `23-war-choice-${season}`);
    await shot(page, `24-war-desk-${season}`, 1500);
  }
  await expect(page.getByTestId('ending.root')).toBeVisible({ timeout: 60_000 });
  await shot(page, '25-ending-bad', 3500);
  const review = page.getByTestId('ending.review');
  if (await review.isVisible().catch(() => false)) {
    await review.click();
    await shot(page, '26-ending-bad-review', 1500);
  }
  await finish(context, page, 'b-rebellion');
});

test('good ending: 天宝中兴 @promo', async ({ browser }) => {
  const sid = process.env.PROMO_GOOD;
  test.skip(!sid, 'PROMO_GOOD not set');
  const { context, page } = await recorder(browser);
  await resume(page, sid!);
  await chooseAll(page);
  await shot(page, '30-desk-good', 1500);
  await advance(page);
  if (!(await ended(page))) {
    await shot(page, '30-result-good', 2400);
    await nextFromResult(page);
  }
  await expect(page.getByTestId('ending.root')).toBeVisible({ timeout: 60_000 });
  await shot(page, '31-ending-good', 3500);
  const review = page.getByTestId('ending.review');
  if (await review.isVisible().catch(() => false)) {
    await review.click();
    await shot(page, '32-ending-good-review', 1500);
  }
  await finish(context, page, 'c-good');
});
