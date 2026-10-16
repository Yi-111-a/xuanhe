// HUD safe area (@safe-area): the lacquer HUD sits on every edge of the desk, so
//  * on load the whole map is fitted inside the area the HUD leaves free: no region name is under a
//    HUD piece or off screen;
//  * every region's label anchor can be dragged into the centre third of the screen, both at the
//    fitted scale and zoomed in, and wherever the map is dragged, a visible name never sits under
//    the HUD (names are nudged inward, or fade out with their region when it leaves the screen).
// Runs in mock mode and, with E2E_API_BASE set, against the real engine.
import { expect, test, type Page } from '@playwright/test';
import { startGame, watchErrors } from './helpers';

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
];

/** Every HUD piece the map must stay clear of (as the player sees them, not the code's own list). */
const HUD = [
  '[data-testid="resources.bar"]',
  '[data-testid="desk.ribbons"]',
  '[data-testid="desk.calendar"]',
  '.objectives',
  '[data-testid="desk.crisis"]',
  '.crisis-title',
  '.medallions',
  '[data-testid="desk.memorialBook"]',
  '[data-testid="desk.replies"]',
  '.layers',
  '[data-testid="desk.edictScroll"]',
  '[data-testid="desk.advance"]',
  '[data-testid="desk.choiceBadge"]',
  '[data-testid="desk.finalNotice"]',
];

interface Box {
  name: string;
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Snapshot {
  vw: number;
  vh: number;
  hud: Box[];
  labels: (Box & { id: string; anchor: [number, number] })[];
  hidden: string[];
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((selectors) => {
    const box = (el: Element, name: string): Box => {
      const r = el.getBoundingClientRect();
      return { name, l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width >= 1 && r.height >= 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const hud: Box[] = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        // the piece and everything drawn inside it (ribbon cloths, the drum's title…), but not
        // hover popovers
        for (const p of [el, ...el.querySelectorAll('*')]) {
          if (p.closest('.popover, .ribbon-tip, .objective-tip, .advance-confirm')) continue;
          if (shown(p)) hud.push(box(p, sel));
        }
      });
    }
    const stage = document.querySelector('[data-testid="map.stage"]') as HTMLElement;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const labels: Snapshot['labels'] = [];
    const hidden: string[] = [];
    document.querySelectorAll('text.region-name').forEach((el) => {
      const id = el.getAttribute('data-label') ?? el.textContent ?? '';
      const [ax, ay] = (el.getAttribute('data-anchor') ?? '0,0').split(',').map(Number);
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || Number(s.opacity) < 0.5) {
        hidden.push(id);
        return;
      }
      labels.push({ ...box(el, el.textContent ?? ''), id, anchor: [sr.left + ax * k, sr.top + ay * k] });
    });
    return { vw: innerWidth, vh: innerHeight, hud, labels, hidden };
  }, HUD);
}

const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

function assertClear(snap: Snapshot, where: string) {
  for (const l of snap.labels) {
    expect(l.l >= 0 && l.t >= 0 && l.r <= snap.vw && l.b <= snap.vh, `${where}: label ${l.name} [${l.l | 0},${l.t | 0},${l.r | 0},${l.b | 0}] is off screen`).toBe(true);
    const under = snap.hud.filter((h) => hit(l, h));
    expect(under.map((h) => h.name), `${where}: label ${l.name} [${l.l | 0},${l.t | 0},${l.r | 0},${l.b | 0}] is under the HUD`).toEqual([]);
  }
}

/** The painted map (the whole content extent) is on screen and clear of every HUD piece. */
async function expectMapClear(page: Page, snap: Snapshot, where: string) {
  const stage = (await page.getByTestId('map.stage').boundingBox())!;
  const map: Box = { name: 'map', l: stage.x, t: stage.y, r: stage.x + stage.width, b: stage.y + stage.height };
  expect(map.l >= 0 && map.t >= 0 && map.r <= snap.vw && map.b <= snap.vh, `${where}: map [${map.l | 0},${map.t | 0},${map.r | 0},${map.b | 0}] fits the screen`).toBe(true);
  const covered = [...new Set(snap.hud.filter((h) => hit(h, map)).map((h) => h.name))];
  expect(covered, `${where}: HUD pieces over the map`).toEqual([]);
}

async function mapReady(page: Page) {
  await expect(page.locator('[data-testid="map.stage"].is-shown')).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => page.locator('text.region-name').count(), { timeout: 15_000 }).toBeGreaterThan(5);
  await page.waitForTimeout(800); // the fade-in / any refit glide
}

/** Drags the map so the anchor of `id` heads for the screen centre; returns its new position. */
async function dragToCentre(page: Page, id: string, vw: number, vh: number): Promise<[number, number]> {
  for (let i = 0; i < 3; i++) {
    const snap = await snapshot(page);
    const a = (await anchorOf(page, id)) ?? snap.labels.find((l) => l.id === id)?.anchor;
    if (!a) throw new Error(`no anchor for ${id}`);
    const dx = vw / 2 - a[0];
    const dy = vh / 2 - a[1];
    if (Math.abs(dx) < vw / 12 && Math.abs(dy) < vh / 12) return a;
    // grab the map at the screen centre (always map, never HUD) and pull
    const sx = vw / 2;
    const sy = vh / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + dx * 0.3, sy + dy * 0.3, { steps: 4 });
    await page.mouse.move(sx + dx, sy + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  return (await anchorOf(page, id))!;
}

async function anchorOf(page: Page, id: string): Promise<[number, number] | null> {
  return page.evaluate((rid) => {
    const el = document.querySelector(`text.region-name[data-label="${rid}"]`);
    const stage = document.querySelector('[data-testid="map.stage"]') as HTMLElement | null;
    if (!el || !stage) return null;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const [ax, ay] = (el.getAttribute('data-anchor') ?? '0,0').split(',').map(Number);
    return [sr.left + ax * k, sr.top + ay * k] as [number, number];
  }, id);
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('map fits inside the HUD-free area; no region name under the HUD @safe-area', async ({ page }) => {
      const errors = watchErrors(page);
      await startGame(page);
      await mapReady(page);
      const snap = await snapshot(page);
      expect(snap.hidden, 'every region name is shown on the fitted map').toEqual([]);
      expect(snap.labels.length).toBeGreaterThan(5);
      assertClear(snap, 'fitted');
      await expectMapClear(page, snap, 'fitted');
      expect(errors).toEqual([]);
    });

    test('every region can be dragged to the centre, names stay clear of the HUD @safe-area', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await startGame(page);
      await mapReady(page);
      const ids = (await snapshot(page)).labels.map((l) => l.id);
      const third = (p: [number, number]) => p[0] >= size.width / 3 && p[0] <= (2 * size.width) / 3 && p[1] >= size.height / 3 && p[1] <= (2 * size.height) / 3;

      // at the fitted scale
      for (const id of ids) {
        const p = await dragToCentre(page, id, size.width, size.height);
        expect(third(p), `fitted: ${id} anchor reached (${p[0] | 0}, ${p[1] | 0})`).toBe(true);
        assertClear(await snapshot(page), `fitted, ${id} centred`);
      }

      // zoomed in (wheel at the centre)
      await page.mouse.move(size.width / 2, size.height / 2);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(200);
      const scale = Number(await page.getByTestId('map.stage').getAttribute('data-scale'));
      const fit = Number(await page.getByTestId('map.stage').getAttribute('data-fit-scale'));
      expect(scale, 'the wheel zooms in from the fitted view').toBeGreaterThan(fit * 1.5);
      for (const id of ids) {
        const p = await dragToCentre(page, id, size.width, size.height);
        expect(third(p), `zoomed: ${id} anchor reached (${p[0] | 0}, ${p[1] | 0})`).toBe(true);
        const snap = await snapshot(page);
        assertClear(snap, `zoomed, ${id} centred`);
        expect(snap.hidden, `zoomed: ${id}'s own name is shown when centred`).not.toContain(id);
      }

      // zooming all the way out brings back the whole map inside the safe area
      await page.mouse.move(size.width / 2, size.height / 2);
      for (let i = 0; i < 14; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(200);
      expect(Number(await page.getByTestId('map.stage').getAttribute('data-scale'))).toBeCloseTo(fit, 3);
      await page.waitForTimeout(800); // glides back to the fitted position
      const snap = await snapshot(page);
      await expectMapClear(page, snap, 'zoomed out');
      expect(snap.hidden).toEqual([]);
      assertClear(snap, 'zoomed out');
      expect(errors).toEqual([]);
    });
  });
}
