// The 官职兵权 panel shows where each army actually is (engine `whereabouts`), never a stale station.
import { expect, test } from '@playwright/test';
import { REAL, startGame, watchErrors } from './helpers';

test.skip(!REAL, 'needs a real engine (E2E_API_BASE)');

test('command panel shows each army whereabouts @command', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  await page.getByTestId('desk.memorialBook').click();
  await expect(page.getByTestId('memorial.root')).toBeVisible();
  const open = page.locator('[data-testid^="memorial."][data-testid*="command"]').first();
  await open.click();
  const panel = page.locator('[data-screen="command"], [data-testid="command.root"]').first();
  await expect(panel).toBeVisible();
  const text = await panel.innerText();
  expect(text).toMatch(/驻|在途/);
  expect(text).not.toMatch(/undefined|null|station/);
  expect(errors).toEqual([]);
});
