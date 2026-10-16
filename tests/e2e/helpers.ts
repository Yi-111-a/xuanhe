// Shared helpers for the 《天宝》 E2E suites (Playwright). Screens are reached through the UI
// itself; in mock mode a few states (pending choice, ending) are forced via window.__tianbaoMock.
import { expect, type Page } from '@playwright/test';

export const REAL = Boolean(process.env.E2E_API_BASE);

export const SCREENS = [
  'title',
  'newgame',
  'desk',
  'resources',
  'map',
  'memorial',
  'audience',
  'debate',
  'edict',
  'result',
  'choice',
  'ending',
  'timeline',
  'settings',
] as const;
export type ScreenName = (typeof SCREENS)[number] | 'advice' | 'command' | 'army' | 'replies';

/** Collects console errors / page errors; tests assert it stays empty. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export async function settle(page: Page, ms = 350) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(ms);
}

export async function freshTitle(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    window.__tianbaoMock?.reset();
  });
  await page.goto('/');
  await expect(page.getByTestId('title.root')).toBeVisible();
  await settle(page);
}

/** Starts a new game. The first seasons open with the 新手引导; suites that are not about it skip it
 *  (through its own 「跳过引导」 button) so its note does not sit over the controls they click. */
export async function startGame(page: Page, opts: { keepTutorial?: boolean } = {}) {
  await freshTitle(page);
  await page.getByTestId('title.newGame').click();
  await expect(page.getByTestId('newgame.root')).toBeVisible();
  await page.getByTestId('newgame.start').click();
  await expect(page.getByTestId('desk.root')).toBeVisible({ timeout: 20_000 });
  await settle(page, 600);
  if (!opts.keepTutorial) await skipTutorial(page);
}

export async function skipTutorial(page: Page) {
  const skip = page.getByTestId('tutorial.skip');
  await skip.waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await expect(page.getByTestId('tutorial.root')).toHaveCount(0, { timeout: 15_000 });
    // the confirmation toast fades on its own; close it so it covers nothing
    await page.getByTestId('toast.close').first().click({ timeout: 2000 }).catch(() => undefined);
    await settle(page, 300);
  }
}

/** The edict's 御笔 (free text) layer is folded away by default: unfold it. */
export async function openBrush(page: Page) {
  if (!(await page.getByTestId('edict.section.military').isVisible().catch(() => false))) {
    await page.getByTestId('edict.brushToggle').click();
    await expect(page.getByTestId('edict.section.military')).toBeVisible();
  }
}

async function sessionId(page: Page): Promise<string> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tianbao.session') ?? 'null') as string);
}

async function refresh(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('tianbao:refresh')));
}

async function onDesk(page: Page) {
  if (!(await page.getByTestId('desk.root').isVisible().catch(() => false))) await startGame(page);
  // close whatever overlay (or the 兵部 drawer) is open
  for (let i = 0; i < 3; i++) {
    const overlay = page.locator('.overlay, [data-testid="army.root"]');
    if ((await overlay.count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

/** Opens a screen from a sensible state. Returns false when the screen cannot be reached (real mode). */
export async function openScreen(page: Page, name: ScreenName, fresh = true): Promise<boolean> {
  switch (name) {
    case 'title':
      if (fresh) await freshTitle(page);
      else {
        // a title screen with a save present (so 继续 is enabled)
        await onDesk(page);
        await page.getByTestId('desk.medallion.title').click();
        await expect(page.getByTestId('title.root')).toBeVisible();
        await settle(page, 900);
      }
      return true;
    case 'newgame':
      await freshTitle(page);
      await page.getByTestId('title.newGame').click();
      await expect(page.getByTestId('newgame.root')).toBeVisible();
      await settle(page, 900);
      return true;
    case 'desk':
      if (fresh) await startGame(page);
      else await onDesk(page);
      return true;
    case 'resources':
      await onDesk(page);
      await page.getByTestId('resources.item.treasury').hover();
      await expect(page.getByTestId('resources.breakdown')).toBeVisible();
      return true;
    case 'map':
      await onDesk(page);
      await page.getByTestId('map.layer.troops').click();
      await page.getByTestId('map.region.fanyang').dispatchEvent('click');
      await expect(page.getByTestId('map.regionCard')).toBeVisible();
      await settle(page);
      return true;
    case 'memorial':
      await onDesk(page);
      await page.getByTestId('desk.memorialBook').click();
      await expect(page.getByTestId('memorial.root')).toBeVisible();
      await settle(page, 900);
      return true;
    case 'audience':
      await onDesk(page);
      await page.getByTestId('desk.medallion.audience').click();
      await expect(page.getByTestId('audience.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'debate':
      await onDesk(page);
      await page.getByTestId('desk.medallion.debate').click();
      await expect(page.getByTestId('debate.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'edict': {
      await onDesk(page);
      await page.getByTestId('desk.edictScroll').click();
      await expect(page.getByTestId('edict.root')).toBeVisible();
      const back = page.getByTestId('edict.backToEdit');
      if (await back.isVisible().catch(() => false)) await back.click();
      const newDraft = page.getByTestId('edict.newDraft');
      if (await newDraft.isVisible().catch(() => false)) await newDraft.click();
      await openBrush(page);
      await page.getByTestId('edict.section.military').fill('命潼关增修关防，选京畿彍骑整训。');
      await settle(page, 900);
      return true;
    }
    case 'result':
      await onDesk(page);
      await page.getByTestId('desk.advance').click();
      if (await page.getByTestId('desk.advance.confirm').isVisible().catch(() => false)) await page.getByTestId('desk.advance.confirm').click();
      await expect(page.getByTestId('result.root')).toBeVisible({ timeout: 30_000 });
      await settle(page, 1000);
      return true;
    case 'choice': {
      if (REAL) return false;
      await onDesk(page);
      const id = await sessionId(page);
      await page.evaluate((sid) => window.__tianbaoMock?.openChoice(sid), id);
      await refresh(page);
      await expect(page.getByTestId('choice.root')).toBeVisible();
      await settle(page, 700);
      return true;
    }
    case 'ending': {
      if (REAL) return false;
      await onDesk(page);
      const id = await sessionId(page);
      await page.evaluate((sid) => window.__tianbaoMock?.forceOutcome(sid, 'e1_zhongxing'), id);
      await refresh(page);
      await expect(page.getByTestId('ending.root')).toBeVisible();
      await settle(page, 1500);
      return true;
    }
    case 'timeline':
      await onDesk(page);
      await page.getByTestId('desk.medallion.timeline').click();
      await expect(page.getByTestId('timeline.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'settings':
      await onDesk(page);
      await page.getByTestId('desk.medallion.settings').click();
      await expect(page.getByTestId('settings.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'command':
      await onDesk(page);
      await page.getByTestId('desk.memorialBook').click();
      await expect(page.getByTestId('memorial.command')).toBeVisible();
      await page.getByTestId('memorial.command').click();
      await expect(page.getByTestId('command.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'advice':
      await onDesk(page);
      await page.getByTestId('desk.medallion.advice').click();
      await expect(page.getByTestId('advice.root')).toBeVisible();
      await settle(page, 600);
      return true;
    case 'army':
      await onDesk(page);
      await page.getByTestId('desk.medallion.army').click();
      await expect(page.getByTestId('army.root')).toBeVisible();
      await expect(page.locator('[data-testid^="army.item."]').first()).toBeVisible({ timeout: 20_000 });
      await settle(page, 900);
      return true;
    case 'replies':
      await onDesk(page);
      await page.getByTestId('desk.replies').click();
      await expect(page.getByTestId('replies.root')).toBeVisible();
      await settle(page, 600);
      return true;
  }
}

/** All text a player could read: visible text, SVG text and user-facing attributes. */
export async function collectText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [document.body.innerText];
    document.querySelectorAll('svg text, svg title').forEach((el) => parts.push(el.textContent ?? ''));
    document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach((el) => {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    });
    document.querySelectorAll('input,textarea,select').forEach((el) => parts.push((el as HTMLInputElement).value ?? ''));
    parts.push(document.title);
    return parts.join('\n');
  });
}

declare global {
  interface Window {
    __tianbaoMock?: { forceOutcome: (s: string, e: string) => void; openChoice: (s: string) => void; reset: () => void; stress: (s: string, on?: boolean) => void };
    __tianbaoApiLog?: { method: string; path: string; at: number }[];
  }
}
