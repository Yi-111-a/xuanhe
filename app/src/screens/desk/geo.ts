// Schematic geography of the Tang empire in 751, used when the art agent's map.base /
// map.json are not available. Coordinates live in a 1600×1067 (3:2) box. The region cells
// are a Voronoi partition of the circuit seats, clipped to the land outline, with
// hand-drawn wobble applied as a global displacement field so shared borders coincide.

export const GEO_W = 1600;
export const GEO_H = 1067;

export type Pt = [number, number];

export const SEATS: Record<string, Pt> = {
  anxi: [190, 330],
  beiting: [330, 205],
  hexi: [610, 330],
  longyou: [610, 470],
  tubo: [380, 660],
  shuofang: [790, 300],
  huihe: [820, 110],
  jingji: [860, 520],
  tongguan: [948, 506],
  hedong: [1000, 375],
  duji: [1035, 525],
  fanyang: [1185, 285],
  pinglu: [1330, 205],
  khitan_xi: [1270, 95],
  hebei: [1135, 410],
  henan: [1135, 575],
  huainan: [1225, 665],
  jiangnan: [1185, 800],
  shannan: [930, 650],
  jiannan: [720, 690],
  nanzhao: [640, 900],
  lingnan: [1010, 935],
};

/** Extra invisible sites that keep foreign cells from swallowing the interior. */
const PHANTOMS: Record<string, Pt> = {
  _w1: [90, 560],
  _sea1: [1500, 560],
  _sea2: [1450, 900],
};

export const LAND: Pt[] = [
  [30, 110], [300, 55], [620, 36], [900, 58], [1150, 36], [1420, 26], [1572, 56], [1575, 165], [1480, 228],
  [1428, 262], [1384, 298], [1330, 312], [1282, 300], [1250, 330], [1268, 372], [1330, 382], [1398, 398],
  [1392, 440], [1322, 470], [1300, 522], [1312, 592], [1292, 642], [1322, 692], [1302, 742], [1272, 802],
  [1232, 862], [1182, 910], [1100, 950], [1030, 975], [962, 1000], [900, 1040], [840, 1052], [760, 1040],
  [680, 1012], [600, 1002], [500, 992], [380, 942], [260, 902], [140, 862], [30, 802],
];

export const RIVERS: { id: string; name: string; pts: Pt[]; width: number }[] = [
  {
    id: 'huanghe',
    name: '黄河',
    width: 4.2,
    pts: [[500, 520], [560, 492], [640, 452], [700, 400], [745, 330], [790, 262], [850, 238], [918, 262], [958, 322], [966, 410], [952, 498], [1000, 510], [1040, 498], [1110, 472], [1180, 432], [1240, 392], [1262, 372]],
  },
  {
    id: 'changjiang',
    name: '长江',
    width: 4.6,
    pts: [[470, 720], [560, 706], [640, 726], [720, 744], [790, 722], [860, 700], [940, 692], [1020, 686], [1100, 676], [1170, 660], [1240, 652], [1300, 645]],
  },
  {
    id: 'weishui',
    name: '渭水',
    width: 2.4,
    pts: [[760, 512], [810, 518], [860, 516], [910, 508], [950, 500]],
  },
  {
    id: 'huaishui',
    name: '淮水',
    width: 2.4,
    pts: [[1000, 610], [1060, 618], [1120, 610], [1190, 614], [1260, 600], [1300, 590]],
  },
];

/** The canal (汴河) and the Grand Canal down to Jiangnan, as the grain lifeline. */
export const CANAL: Pt[] = [[1300, 770], [1250, 700], [1232, 655], [1200, 618], [1150, 585], [1100, 552], [1040, 522], [990, 512], [950, 506], [900, 515], [860, 520]];

export const MOUNTAINS: { at: Pt; n: number; spread: Pt; scale: number }[] = [
  { at: [260, 250], n: 9, spread: [210, 26], scale: 1.0 }, // 天山
  { at: [560, 400], n: 6, spread: [90, 22], scale: 0.9 }, // 祁连
  { at: [870, 590], n: 7, spread: [110, 14], scale: 0.85 }, // 秦岭
  { at: [1070, 400], n: 5, spread: [16, 70], scale: 0.8 }, // 太行
  { at: [380, 760], n: 14, spread: [200, 90], scale: 1.1 }, // 吐蕃高原
  { at: [1030, 880], n: 6, spread: [120, 16], scale: 0.75 }, // 南岭
  { at: [860, 190], n: 5, spread: [100, 16], scale: 0.75 }, // 阴山
  { at: [1230, 245], n: 4, spread: [70, 10], scale: 0.7 }, // 燕山
  { at: [690, 610], n: 5, spread: [60, 40], scale: 0.85 }, // 蜀山
];

/** Seat (治所) names, used when the engine's region records omit them. */
export const SEAT_NAMES: Record<string, string> = {
  jingji: '长安', tongguan: '潼关', duji: '洛阳', hedong: '太原', fanyang: '幽州', pinglu: '营州', hebei: '魏州',
  henan: '汴州', huainan: '扬州', jiangnan: '润州', shannan: '襄阳', jiannan: '成都', longyou: '鄯州', hexi: '凉州',
  shuofang: '灵州', anxi: '龟兹', beiting: '庭州', lingnan: '广州',
};

export const REBEL_PATH = ['fanyang', 'hebei', 'duji', 'tongguan', 'jingji'];

// ---------------------------------------------------------------- Voronoi by half-plane clipping
function clipHalfPlane(poly: Pt[], a: Pt, b: Pt): Pt[] {
  // keep points closer to a than to b
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const side = (p: Pt) => (p[0] - mx) * nx + (p[1] - my) * ny; // <= 0 keeps
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp <= 0) !== (sq <= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

function wobble(p: Pt): Pt {
  const [x, y] = p;
  if (x <= 0.5 || y <= 0.5 || x >= GEO_W - 0.5 || y >= GEO_H - 0.5) return p;
  const dx = 4.2 * Math.sin(x * 0.043 + y * 0.027) + 2.4 * Math.sin(x * 0.11 - y * 0.07 + 1.3);
  const dy = 4.2 * Math.cos(x * 0.031 - y * 0.046) + 2.4 * Math.sin(y * 0.12 + x * 0.05 + 0.7);
  return [x + dx, y + dy];
}

function subdivide(poly: Pt[], step = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) out.push([p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]);
  }
  return out;
}

export function toPath(poly: Pt[]): string {
  if (!poly.length) return '';
  return `M${poly.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;
}

/** Smooth open path through points (Catmull-Rom → cubic Bézier). */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

let cellCache: Record<string, string> | null = null;
export function schematicCells(): Record<string, string> {
  if (cellCache) return cellCache;
  const sites = { ...SEATS, ...PHANTOMS };
  const ids = Object.keys(sites);
  const out: Record<string, string> = {};
  for (const id of Object.keys(SEATS)) {
    let poly: Pt[] = [
      [0, 0],
      [GEO_W, 0],
      [GEO_W, GEO_H],
      [0, GEO_H],
    ];
    for (const other of ids) {
      if (other === id) continue;
      poly = clipHalfPlane(poly, sites[id], sites[other]);
      if (!poly.length) break;
    }
    out[id] = toPath(subdivide(poly).map(wobble));
  }
  cellCache = out;
  return out;
}

export const LAND_PATH = toPath(subdivide(LAND, 10).map(wobble));
