// HUD safe area for the 舆图: the lacquer HUD sits on all four edges of the desk, so the map is
// fitted into the largest rectangle the HUD leaves free, labels are nudged out from under HUD
// pieces, and the hover card is placed clear of both the HUD and the region it describes.
// Everything here is plain geometry in the map-root's pixel space.

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

export const rect = (l: number, t: number, r: number, b: number): Rect => ({ l, t, r, b });
export const width = (a: Rect) => a.r - a.l;
export const height = (a: Rect) => a.b - a.t;
export const hits = (a: Rect, b: Rect) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
export const inside = (a: Rect, outer: Rect) => a.l >= outer.l && a.t >= outer.t && a.r <= outer.r && a.b <= outer.b;
export const shift = (a: Rect, dx: number, dy: number): Rect => ({ l: a.l + dx, t: a.t + dy, r: a.r + dx, b: a.b + dy });
export const grow = (a: Rect, m: number): Rect => ({ l: a.l - m, t: a.t - m, r: a.r + m, b: a.b + m });
const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/** Marker attribute for HUD pieces the map must keep clear of. */
export const HUD_ATTR = 'data-hud';

/**
 * Bounding boxes (relative to `host`) of every visible `[data-hud]` element under `scope`, each
 * the union of the element and its in-flow children (ribbons hang below their rod, the drum has
 * its title under it). Hover popovers are excluded.
 */
export function measureHud(scope: ParentNode, host: DOMRect, selector = `[${HUD_ATTR}]`): Rect[] {
  const out: Rect[] = [];
  scope.querySelectorAll(selector).forEach((el) => {
    const parts = [el, ...el.querySelectorAll(':scope > *, :scope > * > *')].filter(
      (p) => !p.closest('.popover, .ribbon-tip, .objective-tip, .advance-confirm, [data-hud-ignore]') || p === el,
    );
    let box: Rect | null = null;
    for (const p of parts) {
      const r = p.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(p);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      const q = rect(r.left - host.left, r.top - host.top, r.right - host.left, r.bottom - host.top);
      box = box ? rect(Math.min(box.l, q.l), Math.min(box.t, q.t), Math.max(box.r, q.r), Math.max(box.b, q.b)) : q;
    }
    if (box) out.push(box);
  });
  return out;
}

/** Is there a w×h rectangle inside `bounds` touching none of `obstacles`? Returns its top-left. */
function placeable(w: number, h: number, bounds: Rect, obstacles: Rect[]): [number, number][] {
  if (w > width(bounds) || h > height(bounds)) return [];
  // the free region of top-left corners is bounds minus obstacles grown by (w, h); a free point,
  // if any, sits on one of these coordinate lines
  const xs = [bounds.l, bounds.r - w];
  const ys = [bounds.t, bounds.b - h];
  for (const o of obstacles) {
    xs.push(o.r, o.l - w);
    ys.push(o.b, o.t - h);
  }
  const ok: [number, number][] = [];
  for (const x of xs) {
    if (x < bounds.l - 0.01 || x + w > bounds.r + 0.01) continue;
    for (const y of ys) {
      if (y < bounds.t - 0.01 || y + h > bounds.b + 0.01) continue;
      const c = rect(x, y, x + w, y + h);
      if (!obstacles.some((o) => hits(c, o))) ok.push([x, y]);
    }
  }
  return ok;
}

/**
 * Largest rectangle of aspect `aspect` (w/h) that stays inside `bounds` and clear of `obstacles`,
 * centred as well as the free space allows (the most clearance on every side).
 */
export function largestFreeRect(bounds: Rect, obstacles: Rect[], aspect: number): Rect {
  const obs = obstacles.filter((o) => hits(o, bounds));
  let lo = 0;
  let hi = Math.min(width(bounds), height(bounds) * aspect);
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (placeable(mid, mid / aspect, bounds, obs).length) lo = mid;
    else hi = mid;
  }
  // a hair smaller than the maximum so there is room to centre it
  const w = Math.max(1, lo * 0.985);
  const h = w / aspect;
  // pick the placement with the most even clearance: sample the free positions on a grid
  let best: Rect | null = null;
  let bestScore = -Infinity;
  const nx = 40;
  const ny = 40;
  const spanX = width(bounds) - w;
  const spanY = height(bounds) - h;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const x = bounds.l + (spanX * i) / nx;
      const y = bounds.t + (spanY * j) / ny;
      const c = rect(x, y, x + w, y + h);
      if (obs.some((o) => hits(c, o))) continue;
      const score = clearance(c, bounds, obs);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  if (!best) {
    const p = placeable(w, h, bounds, obs)[0] ?? [bounds.l + spanX / 2, bounds.t + spanY / 2];
    best = rect(p[0], p[1], p[0] + w, p[1] + h);
  }
  return best;
}

/** Smallest gap between `c` and anything around it, horizontally and vertically weighed equally. */
function clearance(c: Rect, bounds: Rect, obs: Rect[]): number {
  let left = c.l - bounds.l;
  let right = bounds.r - c.r;
  let top = c.t - bounds.t;
  let bottom = bounds.b - c.b;
  for (const o of obs) {
    const vOverlap = o.t < c.b && o.b > c.t;
    const hOverlap = o.l < c.r && o.r > c.l;
    if (vOverlap && o.r <= c.l) left = Math.min(left, c.l - o.r);
    if (vOverlap && o.l >= c.r) right = Math.min(right, o.l - c.r);
    if (hOverlap && o.b <= c.t) top = Math.min(top, c.t - o.b);
    if (hOverlap && o.t >= c.b) bottom = Math.min(bottom, o.t - c.b);
  }
  // balance opposite sides, then prefer the larger minimum
  return Math.min(left, right, top, bottom) - 0.25 * (Math.abs(left - right) + Math.abs(top - bottom));
}

/**
 * Smallest displacement that moves `box` out from under every obstacle and inside `bounds`,
 * or null when no such spot is within `maxDist`.
 */
export function nudge(box: Rect, bounds: Rect, obstacles: Rect[], maxDist: number): [number, number] | null {
  const clear = (d: [number, number]) => {
    const b = shift(box, d[0], d[1]);
    return inside(b, bounds) && !obstacles.some((o) => hits(b, o));
  };
  if (clear([0, 0])) return [0, 0];
  let frontier: [number, number][] = [[0, 0]];
  const found: [number, number][] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 4 && frontier.length; round++) {
    const next: [number, number][] = [];
    for (const d of frontier) {
      const b = shift(box, d[0], d[1]);
      const moves: [number, number][] = [];
      // into bounds
      if (b.l < bounds.l) moves.push([bounds.l - b.l, 0]);
      if (b.r > bounds.r) moves.push([bounds.r - b.r, 0]);
      if (b.t < bounds.t) moves.push([0, bounds.t - b.t]);
      if (b.b > bounds.b) moves.push([0, bounds.b - b.b]);
      // out from under each obstacle it touches, in the four directions
      for (const o of obstacles) {
        if (!hits(b, o)) continue;
        moves.push([o.r - b.l + 0.5, 0], [o.l - b.r - 0.5, 0], [0, o.b - b.t + 0.5], [0, o.t - b.b - 0.5]);
      }
      for (const m of moves) {
        const nd: [number, number] = [d[0] + m[0], d[1] + m[1]];
        if (Math.hypot(nd[0], nd[1]) > maxDist) continue;
        const key = `${Math.round(nd[0])},${Math.round(nd[1])}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (clear(nd)) found.push(nd);
        else next.push(nd);
      }
    }
    frontier = next;
  }
  if (!found.length) return null;
  found.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  return found[0];
}

/**
 * Where to put a floating card of size w×h: clear of the HUD, inside `bounds`, preferably not over
 * `avoid` (the hovered region) or the `soft` boxes (other names), and close to the cursor. Returns the card's top-left.
 */
export function placeCard(
  w: number,
  h: number,
  cursor: [number, number],
  avoid: Rect | null,
  bounds: Rect,
  obstacles: Rect[],
  soft: Rect[] = [],
  gap = 16,
): [number, number] {
  const clampX = (x: number) => Math.max(bounds.l, Math.min(bounds.r - w, x));
  const clampY = (y: number) => Math.max(bounds.t, Math.min(bounds.b - h, y));
  const [cx, cy] = cursor;
  const cands: [number, number][] = [
    [cx + 20, cy + 20],
    [cx - 20 - w, cy + 20],
    [cx + 20, cy - 20 - h],
    [cx - 20 - w, cy - 20 - h],
  ];
  if (avoid) {
    const my = (Math.max(avoid.t, bounds.t) + Math.min(avoid.b, bounds.b)) / 2 - h / 2;
    const mx = (Math.max(avoid.l, bounds.l) + Math.min(avoid.r, bounds.r)) / 2 - w / 2;
    for (const y of [cy - h / 2, my]) {
      cands.push([avoid.r + gap, y], [avoid.l - gap - w, y]);
    }
    for (const x of [cx - w / 2, mx]) {
      cands.push([x, avoid.b + gap], [x, avoid.t - gap - h]);
    }
  }
  // also slide each candidate out from under the HUD
  const extra: [number, number][] = [];
  for (const [x, y] of cands) {
    const c = rect(clampX(x), clampY(y), clampX(x) + w, clampY(y) + h);
    for (const o of obstacles) {
      if (!hits(c, o)) continue;
      extra.push([o.r + 8, c.t], [o.l - 8 - w, c.t], [c.l, o.b + 8], [c.l, o.t - 8 - h]);
    }
  }
  let best: [number, number] = [clampX(cx + 20), clampY(cy + 20)];
  let bestScore = Infinity;
  for (const [x0, y0] of [...cands, ...extra]) {
    const x = clampX(x0);
    const y = clampY(y0);
    const c = rect(x, y, x + w, y + h);
    const hud = obstacles.reduce((a, o) => a + overlapArea(c, o), 0);
    const region = avoid ? overlapArea(c, avoid) : 0;
    const names = soft.reduce((a, o) => a + overlapArea(c, o), 0);
    const dist = Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    const score = hud * 1e4 + region * 6 + names * 2 + dist;
    if (score < bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  return best;
}
