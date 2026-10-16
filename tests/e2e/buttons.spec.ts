// G1 按钮清单: on every screen, inventory all interactive [data-testid] elements, operate each
// one and assert an observable effect (DOM change, API request, or form value change).
// Any console error or unhandled rejection fails the test.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openBrush, openScreen, REAL, settle, watchErrors, type ScreenName } from './helpers';

const INVENTORY_SCREENS: ScreenName[] = [
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
  'advice',
  'army',
  'replies',
];

interface Item {
  id: string;
  tag: string;
  type: string;
  disabled: boolean;
  svg: boolean;
}

async function inventory(page: Page, screen: ScreenName): Promise<Item[]> {
  return page.$$eval('[data-testid]', (els, scr) => {
    const out: { id: string; tag: string; type: string; disabled: boolean; svg: boolean }[] = [];
    const seen = new Set<string>();
    for (const el of els) {
      const id = el.getAttribute('data-testid')!;
      if (seen.has(id) || id.startsWith('toast.') || id.endsWith('.root')) continue;
      // scope: a panel's own elements; the desk minus overlays; resources/map by testid prefix
      if (scr === 'desk') {
        if (el.closest('.overlay')) continue;
      } else if (scr === 'resources' || scr === 'map') {
        if (!id.startsWith(`${scr}.`) || el.closest('.overlay')) continue;
      } else if (!el.closest(`[data-screen="${scr}"]`)) continue;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const interactive = ['button', 'a', 'input', 'textarea', 'select'].includes(tag) || role === 'button' || role === 'tab';
      if (!interactive) continue;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = (r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') || el instanceof SVGElement;
      if (!visible) continue;
      seen.add(id);
      out.push({
        id,
        tag,
        type: (el as HTMLInputElement).type ?? '',
        disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true',
        svg: el instanceof SVGElement,
      });
    }
    return out;
  }, screen);
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const html = document.body.innerHTML;
    let h = 0;
    for (let i = 0; i < html.length; i += 7) h = (h * 31 + html.charCodeAt(i)) | 0;
    const values = [...document.querySelectorAll('input,textarea,select')].map((e) => (e as HTMLInputElement).value).join('|');
    return {
      dom: `${html.length}:${h}`,
      values,
      api: window.__tianbaoApiLog?.length ?? 0,
      active: document.activeElement?.getAttribute('data-testid') ?? '',
    };
  });
}

async function operate(page: Page, loc: Locator, item: Item): Promise<string | null> {
  if (item.tag === 'input' && item.type === 'range') {
    const before = await loc.inputValue();
    await loc.focus();
    await page.keyboard.press('ArrowRight');
    if ((await loc.inputValue()) === before) await page.keyboard.press('ArrowLeft');
    return (await loc.inputValue()) !== before ? null : 'slider did not move';
  }
  if (item.tag === 'input' || item.tag === 'textarea') {
    const before = await loc.inputValue();
    const next = item.type === 'number' ? String((Number(before) || 0) + 7) : `${before}测试谏言`;
    await loc.fill(next);
    const after = await loc.inputValue();
    return after !== before ? null : 'value did not change';
  }
  if (item.tag === 'select') {
    const before = await loc.inputValue();
    const options = await loc.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const target = options.find((v) => v !== before);
    if (!target) return 'select has a single option';
    await loc.selectOption(target);
    return (await loc.inputValue()) !== before ? null : 'selection did not change';
  }
  if (!item.svg) {
    await loc.hover({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  const before = await snapshot(page);
  if (item.svg) await loc.dispatchEvent('click');
  else await loc.click({ timeout: 5000 });
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(120);
    const now = await snapshot(page).catch(() => null);
    if (!now) return null; // navigation counts as an effect
    if (now.dom !== before.dom || now.api !== before.api || now.values !== before.values) return null;
    if (now.active !== before.active && now.active !== item.id) return null;
  }
  return 'no observable effect';
}

for (const screen of INVENTORY_SCREENS) {
  test(`buttons on "${screen}" all have an observable effect @buttons`, async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const errors = watchErrors(page);
    const reached = await openScreen(page, screen, screen !== 'title');
    test.skip(!reached, `screen ${screen} not reachable in ${REAL ? 'real' : 'mock'} mode`);
    const items = await inventory(page, screen);
    expect(items.length, `inventory of ${screen}`).toBeGreaterThan(0);
    const failures: string[] = [];
    const skipped: string[] = [];
    let clicked = 0;
    for (const item of items) {
      if (process.env.E2E_VERBOSE) console.log(`[buttons] … ${item.id}`);
      let loc = page.locator(`[data-testid="${item.id}"]`).first();
      const reachable = async () =>
        loc
          .evaluate((el) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return Boolean(hit) && (el === hit || el.contains(hit) || (el.closest('label') !== null && (hit as Element).closest('label') === el.closest('label')));
          }, undefined, { timeout: 1500 })
          .catch(() => false);
      const overlayOpen = async () => (await page.locator('.overlay').count()) > 0 && (await loc.evaluate((el) => !el.closest('.overlay'), undefined, { timeout: 1500 }).catch(() => true));
      if (item.svg ? await overlayOpen() : !(await reachable())) {
        await openScreen(page, screen, false);
        loc = page.locator(`[data-testid="${item.id}"]`).first();
      }
      if ((await loc.count()) === 0 || (!item.svg && !(await loc.isVisible().catch(() => false)))) {
        failures.push(`${item.id}: not present after reopening ${screen}`);
        continue;
      }
      const disabled = await loc.isDisabled({ timeout: 1500 }).catch(() => false);
      if (disabled) {
        skipped.push(item.id);
        continue;
      }
      const problem = await operate(page, loc, item).catch((e: Error) => `error: ${e.message.split('\n')[0]}`);
      clicked += 1;
      if (problem) {
        failures.push(`${item.id}: ${problem}`);
        console.log(`[buttons] FAIL ${item.id}: ${problem}`);
      }
      await settle(page, 450); // let exit animations finish before the next hit-test
    }
    test.info().annotations.push({ type: 'inventory', description: `${screen}: ${items.length} elements, ${clicked} operated, ${skipped.length} disabled (${skipped.join(', ')})` });
    console.log(`[buttons] ${screen}: ${items.length} elements, ${clicked} operated, disabled: ${skipped.join(', ') || '—'}`);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// Elements that only appear in particular states, exercised as flows.
test('flows: adopt → edict chip → remove; preview → promulgate → advance; confirm dialog @buttons', async ({ page }) => {
  const errors = watchErrors(page);
  await openScreen(page, 'memorial');
  const option = page.locator('[data-testid^="memorial.option."]').first();
  await option.click();
  await expect(option.locator('.memorial-option-seal')).toHaveText('准');
  await page.getByTestId('memorial.toEdict').click();
  await expect(page.getByTestId('edict.root')).toBeVisible();
  const remove = page.locator('[data-testid^="edict.removeAdopted."]').first();
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.locator('[data-testid^="edict.removeAdopted."]')).toHaveCount(0);
  await openBrush(page);
  await page.getByTestId('edict.section.interior').fill('遣御史分道巡察河北诸郡。关中和籴以实太仓。');
  await page.getByTestId('edict.preview').click();
  await expect(page.getByTestId('edict.receipt')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid^="edict.clause."]').first()).toBeVisible();
  await page.getByTestId('edict.promulgate').click();
  await expect(page.getByTestId('edict.advance')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('edict.advance').click();
  await expect(page.getByTestId('result.root')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="result.clause."]').first()).toBeVisible();
  await page.getByTestId('result.next').click();
  await expect(page.getByTestId('result.root')).toHaveCount(0);
  // unconfirmed draft → advance asks first
  await page.getByTestId('desk.edictScroll').click();
  await openBrush(page);
  await page.getByTestId('edict.section.other').fill('赐百官宴于曲江。');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('edict.root')).toHaveCount(0);
  await page.getByTestId('desk.advance').click();
  await expect(page.getByTestId('desk.advance.confirm')).toBeVisible();
  await page.getByTestId('desk.advance.cancel').click();
  await expect(page.getByTestId('desk.advance.confirm')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('flows: choice defer → badge → choose; Esc closes panels; error toast @buttons', async ({ page }) => {
  test.skip(REAL, 'needs mock hooks');
  const errors = watchErrors(page);
  await openScreen(page, 'choice');
  await page.getByTestId('choice.defer').click();
  await expect(page.getByTestId('choice.root')).toHaveCount(0);
  await page.getByTestId('desk.choiceBadge').click();
  await expect(page.getByTestId('choice.root')).toBeVisible();
  await page.locator('[data-testid^="choice.option."]').first().click();
  await expect(page.getByTestId('choice.root')).toHaveCount(0, { timeout: 10_000 });
  // Esc closes each panel
  for (const [opener, root] of [
    ['desk.memorialBook', 'memorial.root'],
    ['desk.medallion.audience', 'audience.root'],
    ['desk.medallion.debate', 'debate.root'],
    ['desk.edictScroll', 'edict.root'],
    ['desk.medallion.timeline', 'timeline.root'],
    ['desk.medallion.settings', 'settings.root'],
    ['desk.medallion.advice', 'advice.root'],
  ]) {
    await page.getByTestId(opener).click();
    await expect(page.getByTestId(root)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(root)).toHaveCount(0);
  }
  // an API error surfaces as a styled toast carrying the engine's {detail:{code,message}}
  await page.evaluate(() => {
    window.__tianbaoMock?.reset();
    window.dispatchEvent(new Event('tianbao:refresh'));
  });
  const toast = page.getByTestId('toast.item').filter({ hasText: '存档不存在' });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute('data-code', 'SESSION_NOT_FOUND');
  await toast.getByTestId('toast.close').click();
  await expect(toast).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('flows: audience streaming + highlight-to-save advice @buttons', async ({ page }) => {
  const errors = watchErrors(page);
  await openScreen(page, 'audience');
  await page.getByTestId('audience.input').fill('卿以为范阳之兵如何？');
  await page.getByTestId('audience.send').click();
  await expect(page.getByTestId('audience.stop')).toBeVisible();
  await expect(page.getByTestId('audience.send')).toBeVisible({ timeout: 30_000 });
  const slip = page.locator('.msg--minister .msg-slip').last();
  await expect(slip).not.toHaveText('');
  // select part of the minister's reply and save it
  await slip.evaluate((el) => {
    const node = el.firstChild!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(8, node.textContent!.length));
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await slip.dispatchEvent('mouseup', { bubbles: true });
  await expect(page.getByTestId('audience.saveSelection')).toBeVisible();
  await page.getByTestId('audience.saveSelection').click();
  await expect(page.getByTestId('toast.item').filter({ hasText: '谏言库' })).toBeVisible();
  await page.getByTestId('audience.adviceLibrary').click();
  await expect(page.getByTestId('advice.root')).toBeVisible();
  await expect(page.locator('[data-testid^="advice.cite."]')).toHaveCount(1);
  await page.getByTestId('advice.cite.0').click();
  await expect(page.getByTestId('edict.root')).toBeVisible();
  await expect(page.getByTestId('edict.section.other')).toHaveValue(/援/);
  expect(errors).toEqual([]);
});
