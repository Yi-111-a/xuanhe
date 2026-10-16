// Map navigation the player expects: mouse wheel zooms around the cursor, holding the left button
// drags the map, and the on-map buttons zoom in/out and reset to the fitted view.
import { expect, test } from '@playwright/test';
import { startGame, watchErrors } from './helpers';

const scale = async (page: import('@playwright/test').Page) =>
  Number(await page.getByTestId('map.stage').getAttribute('data-scale'));

for (const [w, h] of [[1920, 1080], [1366, 768]] as const) {
  test(`wheel zoom, left-drag pan and zoom buttons at ${w}x${h} @map-zoom`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: w, height: h });
    await startGame(page);
    const fit = Number(await page.getByTestId('map.stage').getAttribute('data-fit-scale'));
    const stage = page.getByTestId('map.stage');
    const box = (await stage.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -100); // one notch
    await page.waitForTimeout(250);
    const oneNotch = await scale(page);
    expect(oneNotch / fit).toBeGreaterThan(1.12);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(120); }
    expect((await scale(page)) / fit).toBeGreaterThan(1.5);

    const before = await stage.evaluate((el) => (el as HTMLElement).style.transform);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(cx + 160, cy + 90, { steps: 12 });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(200);
    expect(await stage.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);

    await page.getByTestId('map.zoomReset').click();
    await page.waitForTimeout(900);
    expect(Math.abs((await scale(page)) - fit)).toBeLessThan(0.002);
    await page.getByTestId('map.zoomIn').click();
    await page.waitForTimeout(200);
    expect(await scale(page)).toBeGreaterThan(fit * 1.2);
    await page.getByTestId('map.zoomOut').click();
    await page.waitForTimeout(900);
    expect(await scale(page)).toBeLessThan(fit * 1.05);
    await page.screenshot({ path: `../playtests/screens/iter3/zoom-${w}.png` });
    expect(errors).toEqual([]);
  });
}
