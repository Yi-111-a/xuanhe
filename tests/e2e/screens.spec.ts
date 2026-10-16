// Screenshot every screen at 1920×1080 and 1366×768 into playtests/screens/<iter>/ and check
// that nothing overflows the window (the app is a fixed, non-scrolling game surface).
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openScreen, REAL, SCREENS, watchErrors, type ScreenName } from './helpers';

const here = __dirname; // specs are compiled as CommonJS by Playwright
const ITER = process.env.SCREENS_ITER ?? 'iter1';
const OUT = path.resolve(here, '..', '..', 'playtests', 'screens', ITER);
const SIZES = [
  { w: 1920, h: 1080 },
  { w: 1366, h: 768 },
];
const EXTRA: ScreenName[] = ['advice', 'command', 'army', 'replies'];

for (const size of SIZES) {
  test.describe(`${size.w}x${size.h}`, () => {
    test.use({ viewport: { width: size.w, height: size.h } });
    for (const screen of [...SCREENS, ...EXTRA]) {
      test(`screenshot ${screen} @screens`, async ({ page }) => {
        const errors = watchErrors(page);
        const reached = await openScreen(page, screen);
        test.skip(!reached, `screen ${screen} not reachable in ${REAL ? 'real' : 'mock'} mode`);
        if (screen !== 'resources') await page.mouse.move(2, size.h - 2);
        await page.waitForTimeout(500);
        fs.mkdirSync(OUT, { recursive: true });
        await page.screenshot({ path: path.join(OUT, `${screen}-${size.w}x${size.h}${REAL ? '-real' : ''}.png`) });
        // no page-level overflow
        const overflow = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
          w: innerWidth,
          h: innerHeight,
        }));
        expect(overflow.sw, 'horizontal overflow').toBeLessThanOrEqual(overflow.w);
        expect(overflow.sh, 'vertical overflow').toBeLessThanOrEqual(overflow.h);
        // every visible button / input lies inside the viewport
        const outside = await page.$$eval('[data-testid]', (els) =>
          els
            .filter((el) => ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return false;
              // elements inside scrollable containers may legitimately be scrolled out of view
              let p = el.parentElement;
              while (p) {
                const s = getComputedStyle(p);
                if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) return false;
                p = p.parentElement;
              }
              return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1;
            })
            .map((el) => el.getAttribute('data-testid')),
        );
        expect(outside, 'controls outside the viewport').toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}
