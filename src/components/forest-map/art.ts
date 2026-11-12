/* The plan illustration (inline SVG markup, plan units): a hand-drawn top view of the plot
   on paper — surroundings, fence, walkways, the fire clearing, the kitchen, the dogs' yard,
   the outdoor classroom and the contour rows (swales) the trees stand on.
   Lines are "ink" (bark, non-scaling hairlines); areas are flat sage/sand washes. */
import type { Spot } from '../forest-map';
import { PLAN, PLAN_LABELS, type Pt } from './plan';
import { he } from '../../content/he';
import {
  rng, pt, smooth, sketchLoop, sketchLine, sketchCircle, rectPts, rectPath, wobble, type Rand,
} from './sketch';

const P = (d: string, cls: string, extra = '') => `<path class="${cls}" d="${d}"${extra}/>`;

/** parallel furrows inside a rotated rectangle (one path) */
function hatch(cx: number, cy: number, w: number, h: number, rot: number, gap: number, r: Rand, inset = 0): string {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const tr = (x: number, y: number): Pt => [cx + x * c - y * s, cy + x * s + y * c];
  let d = '';
  for (let y = -h / 2 + gap / 2; y < h / 2; y += gap) {
    const x0 = -w / 2 + inset + r() * 10, x1 = w / 2 - inset - r() * 10;
    const pts = wobble([tr(x0, y), tr(x1, y + (r() - 0.5) * 3)], r, 1.1, 60);
    d += smooth(pts, false, 0.8);
  }
  return d;
}
/** dotted orchard rows (neighbours) */
function orchard(cx: number, cy: number, w: number, h: number, rot: number, gap: number, r: Rand): string {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  let d = '';
  for (let y = -h / 2 + gap / 2; y < h / 2; y += gap) {
    for (let x = -w / 2 + gap / 2; x < w / 2; x += gap) {
      const jx = x + (r() - 0.5) * 6, jy = y + (r() - 0.5) * 6;
      const px = cx + jx * c - jy * s, py = cy + jx * s + jy * c;
      const rad = 7 + r() * 3;
      d += `M${(px - rad).toFixed(1)} ${py.toFixed(1)}a${rad.toFixed(1)} ${rad.toFixed(1)} 0 1 0 ${(rad * 2).toFixed(1)} 0a${rad.toFixed(1)} ${rad.toFixed(1)} 0 1 0 ${(-rad * 2).toFixed(1)} 0`;
    }
  }
  return d;
}
/** ticks perpendicular to a closed polygon every `step` (fence posts) */
function posts(poly: readonly Pt[], step: number, len: number, skip?: { x: number; y: number; w: number }): string {
  let d = '';
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    for (let t = step / 2; t < L; t += step) {
      const x = a[0] + (dx * t) / L, y = a[1] + (dy * t) / L;
      if (skip && Math.hypot(x - skip.x, y - skip.y) < skip.w * 0.7) continue;
      d += `M${(x - nx * len).toFixed(1)} ${(y - ny * len).toFixed(1)}L${(x + nx * len).toFixed(1)} ${(y + ny * len).toFixed(1)}`;
    }
  }
  return d;
}
function arc(cx: number, cy: number, rad: number, a0: number, a1: number): string {
  const p = (a: number) => `${(cx + Math.cos((a * Math.PI) / 180) * rad).toFixed(1)} ${(cy + Math.sin((a * Math.PI) / 180) * rad).toFixed(1)}`;
  return `M${p(a0)}A${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}
function paw(x: number, y: number, rot: number): string {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const tr = (px: number, py: number) => [x + px * c - py * s, y + px * s + py * c];
  const dot = (px: number, py: number, rr: number) => { const [X, Y] = tr(px, py); return `M${(X - rr).toFixed(1)} ${Y.toFixed(1)}a${rr} ${rr} 0 1 0 ${rr * 2} 0a${rr} ${rr} 0 1 0 ${-rr * 2} 0`; };
  return dot(0, 2.2, 2.6) + dot(-3.4, -2.2, 1.2) + dot(-1.2, -3.8, 1.2) + dot(1.2, -3.8, 1.2) + dot(3.4, -2.2, 1.2);
}

/** surroundings: fields, neighbours' orchards, the wadi, the moshav road and houses */
export function envArt(): string {
  const r = rng(77);
  const fields = [
    hatch(-290, 250, 300, 720, 7, 24, r),
    hatch(-270, 1060, 360, 420, -5, 28, r),
    hatch(1250, -230, 880, 210, 2, 22, r),
    hatch(1840, 320, 340, 720, -4, 26, r),
  ].join('');
  const groves = [orchard(330, -210, 720, 220, -3, 56, r), orchard(1840, 930, 330, 380, 5, 52, r)].join('');
  const bounds = [
    rectPath(-290, 250, 312, 732, 7, r, 2), rectPath(-270, 1060, 372, 432, -5, r, 2),
    rectPath(1250, -230, 892, 222, 2, r, 2), rectPath(1840, 320, 352, 732, -4, r, 2),
    rectPath(330, -210, 732, 232, -3, r, 2), rectPath(1840, 930, 342, 392, 5, r, 2),
  ].join('');
  const wadiPts: Pt[] = [[-90, -360], [-60, -80], [-110, 220], [-58, 520], [-120, 820], [-86, 1080], [-140, 1360]];
  const wadi = sketchLine(wadiPts, r, 3, 60) + sketchLine(wadiPts.map(([x, y]) => [x + 16, y + 4] as Pt), r, 3, 60);
  const road: Pt[] = [[-460, 1168], [200, 1158], [800, 1172], [1250, 1160], [1700, 1176], [2060, 1166]];
  const roadD = smooth(wobble(road, r, 2, 80), false, 0.9);
  let houses = '';
  const hx = [380, 520, 690, 860, 1020, 1400, 1560, 1720, 1880, 2010];
  hx.forEach((x, i) => {
    const y = 1252 + (i % 3) * 22, w = 70 + (i % 2) * 18, h = 48 + (i % 3) * 6, rot = (r() - 0.5) * 8;
    houses += rectPath(x, y, w, h, rot, r, 0.6);
    const q = rectPts(x, y, w, h, rot);
    houses += `M${pt([(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2])}L${pt([(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2])}`;
  });
  return `<g class="fmap__env" aria-hidden="true">
    ${P(bounds, 'fmap__ink fmap__ink--faint')}
    ${P(fields, 'fmap__ink fmap__ink--furrow')}
    ${P(groves, 'fmap__ink fmap__ink--faint')}
    ${P(wadi, 'fmap__ink fmap__ink--faint')}
    ${P(roadD, 'fmap__road-edge')}${P(roadD, 'fmap__road')}
    ${P(houses, 'fmap__ink fmap__ink--faint')}
  </g>`;
}

/** the plot itself */
export function plotArt(spots: Spot[]): string {
  const r = rng(427);
  const fenceD = sketchLoop(PLAN.fence, r, 2.2, 46);
  const fenceD2 = sketchLoop(PLAN.fence, r, 2.6, 52);
  const g = PLAN.gate;
  const gateCut = `M${g.x - g.w / 2} ${g.y + 1}L${g.x + g.w / 2} ${g.y - 1}`;

  // walkways: a wide sand band with a darker under-edge
  const walks = PLAN.paths.map((p) => {
    const d = smooth(wobble(p.pts, r, 1.4, 40), false, 0.9);
    return { d, w: p.w };
  });
  const walkEdge = walks.map(({ d, w }) => P(d, 'fmap__walk-edge', ` style="stroke-width:${w + 3.2}"`)).join('');
  const walkFill = walks.map(({ d, w }) => P(d, 'fmap__walk', ` style="stroke-width:${w}"`)).join('');
  // gravel: tiny dots scattered along the walkways
  let gravel = '';
  PLAN.paths.forEach((p) => {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < L; t += 9) {
        if (r() < 0.55) continue;
        const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, o = (r() - 0.5) * p.w * 0.7;
        gravel += `M${(a[0] + ((b[0] - a[0]) * t) / L + nx * o).toFixed(1)} ${(a[1] + ((b[1] - a[1]) * t) / L + ny * o).toFixed(1)}h.01`;
      }
    }
  });

  // the clearing: sand circle, ring of stones, the fire, log seats
  const c = PLAN.clearing;
  const clearingFill = sketchCircle(c.x, c.y, c.r, r, 0.03, 22);
  const clearingInk = sketchCircle(c.x, c.y, c.r + 1, r, 0.035, 20);
  let stones = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.2, rr = 3.4 + r() * 1.4;
    stones += sketchCircle(c.x + Math.cos(a) * 19, c.y - 8 + Math.sin(a) * 19, rr, r, 0.12, 6);
  }
  const flame = `M${c.x} ${c.y - 2}c-5 0-8-3-8-7 0-5 4.5-7 5.4-12.5 3.4 2.2 5 4.8 5.1 7.9 1.2-.9 1.9-2.4 2.2-3.8 2.2 2 3.5 5 3.5 8.2 0 4.6-3.4 7.2-8.2 7.2Z`;
  let logs = '';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2 + 0.3;
    const x = c.x + Math.cos(a) * 58, y = c.y - 8 + Math.sin(a) * 58;
    logs += rectPath(x, y, 30, 9, (a * 180) / Math.PI + 90, r, 0.4);
  }

  // kitchen under a pergola
  const k = PLAN.kitchen;
  const kitchen = rectPath(k.x, k.y, k.w, k.h, k.rot, r, 1);
  const kq = rectPts(k.x, k.y, k.w, k.h, k.rot);
  let beams = '';
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const a: Pt = [kq[0][0] + (kq[1][0] - kq[0][0]) * t, kq[0][1] + (kq[1][1] - kq[0][1]) * t];
    const b: Pt = [kq[3][0] + (kq[2][0] - kq[3][0]) * t, kq[3][1] + (kq[2][1] - kq[3][1]) * t];
    beams += `M${pt(a)}L${pt(b)}`;
  }
  const counter = rectPath(k.x, k.y - k.h / 2 + 16, k.w - 26, 14, k.rot, r, 0.5);
  const oven = sketchCircle(k.x + k.w / 2 + 22, k.y - 18, 13, r, 0.05, 10) + sketchCircle(k.x + k.w / 2 + 22, k.y - 18, 6, r, 0.08, 8);
  const longTable = rectPath(k.x - 6, k.y + 14, 92, 18, k.rot, r, 0.5);

  // herb beds
  let beds = '', bedRows = '';
  PLAN.beds.forEach((b) => {
    beds += rectPath(b.x, b.y, b.w, b.h, b.rot, r, 0.8);
    for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) bedRows += `M${(b.x + i * 7.5).toFixed(1)} ${(b.y + j * 9).toFixed(1)}h.01`;
  });

  // dogs' yard
  const dy = PLAN.dogYard;
  const yardFill = sketchLoop(dy.poly, r, 1.6, 40);
  const yardFence = sketchLoop(dy.poly, r, 1.2, 30);
  const hs = dy.house;
  const house = rectPath(hs.x, hs.y, hs.w, hs.h, hs.rot, r, 0.6);
  const hq = rectPts(hs.x, hs.y, hs.w, hs.h, hs.rot);
  const roof = `M${pt(hq[0])}L${pt([(hq[1][0] + hq[2][0]) / 2, (hq[1][1] + hq[2][1]) / 2])}L${pt(hq[3])}`
    + `M${pt([(hq[0][0] + hq[3][0]) / 2, (hq[0][1] + hq[3][1]) / 2])}L${pt([(hq[1][0] + hq[2][0]) / 2, (hq[1][1] + hq[2][1]) / 2])}`;
  const bowl = sketchCircle(dy.bowl[0], dy.bowl[1], 10, r, 0.05, 10) + sketchCircle(dy.bowl[0], dy.bowl[1], 5.5, r, 0.06, 8);
  const poles = dy.poles.map(([x, y]) => sketchCircle(x, y, 3.2, r, 0.1, 6)).join('');
  const [tx, ty] = dy.tunnel;
  const tunnel = arc(tx, ty, 26, 200, 340) + arc(tx, ty, 36, 200, 340);
  const paws = dy.paws.map(([x, y], i) => paw(x, y, -35 + (i % 2) * 10)).join('');

  // outdoor classroom
  const cl = PLAN.classroom;
  let benches = '';
  cl.r.forEach((rad, i) => {
    const a0 = -128 + i * 4, a1 = 28 - i * 4;
    benches += arc(cl.x, cl.y, rad, a0, a1);
  });
  const board = rectPath(cl.x - 4, cl.y + 6, 44, 7, 40, r, 0.3);

  // contour rows the trees stand on (from the data, so they always match)
  const rows = new Map<string, Spot[]>();
  spots.forEach((s) => { if (s.row) (rows.get(s.row) ?? rows.set(s.row, []).get(s.row)!).push(s); });
  let swales = '', ditches = '';
  rows.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    if (sorted.length < 2) return;
    const a = sorted[0], b = sorted[1], y = sorted[sorted.length - 2], z = sorted[sorted.length - 1];
    const ext = (p: Spot, q: Spot, f: number): Pt => [p.x + (p.x - q.x) * f, p.y + (p.y - q.y) * f];
    const pts: Pt[] = [ext(a, b, 0.45), ...sorted.map((s) => [s.x, s.y] as Pt), ext(z, y, 0.45)].map(([x, yy]) => [x, yy + 13] as Pt);
    swales += smooth(pts, false, 0.9);
    ditches += smooth(pts.map(([x, yy]) => [x, yy - 7] as Pt), false, 0.9);
  });

  // compass + scale bar
  const [cx, cy] = PLAN.compass;
  const compass = sketchCircle(cx, cy, 20, r, 0.03, 12)
    + `M${cx} ${cy - 30}L${cx + 6} ${cy}L${cx} ${cy + 26}L${cx - 6} ${cy}Z`;
  const sb = PLAN.scale;
  const scale = `M${sb.x} ${sb.y}h${sb.len / 2}M${sb.x} ${sb.y - 6}v12M${sb.x + sb.len / 4} ${sb.y - 4}v8M${sb.x + sb.len / 2} ${sb.y - 6}v12`;

  return `<g class="fmap__plot" aria-hidden="true">
    ${P(fenceD, 'fmap__ground')}
    <g class="fmap__layer fmap__layer--swales">${P(swales, 'fmap__swale')}${P(ditches, 'fmap__ink fmap__ink--ditch fmap__draw')}</g>
    <g class="fmap__layer fmap__layer--walks">${walkEdge}${walkFill}${P(gravel, 'fmap__gravel')}</g>
    <g class="fmap__layer fmap__layer--features">
      ${P(clearingFill, 'fmap__sand')}${P(clearingInk, 'fmap__ink fmap__draw')}
      ${P(stones, 'fmap__ink fmap__ink--thin fmap__draw')}${P(flame, 'fmap__flame fmap__draw')}${P(logs, 'fmap__wood fmap__draw')}
      ${P(kitchen, 'fmap__sand')}${P(kitchen, 'fmap__ink fmap__draw')}${P(beams, 'fmap__ink fmap__ink--thin fmap__draw')}
      ${P(counter, 'fmap__ink fmap__ink--thin fmap__draw')}${P(longTable, 'fmap__wood fmap__draw')}${P(oven, 'fmap__ink fmap__ink--thin fmap__draw')}
      ${P(beds, 'fmap__bed')}${P(beds, 'fmap__ink fmap__ink--thin fmap__draw')}${P(bedRows, 'fmap__seedling')}
      ${P(yardFill, 'fmap__yard')}${P(yardFence, 'fmap__ink fmap__ink--dash')}
      ${P(house, 'fmap__sand')}${P(house + roof, 'fmap__ink fmap__ink--thin fmap__draw')}${P(bowl + poles, 'fmap__ink fmap__ink--thin fmap__draw')}
      ${P(tunnel, 'fmap__ink fmap__ink--thin fmap__draw')}${P(paws, 'fmap__paw')}
      ${P(benches, 'fmap__bench-arc')}${P(board, 'fmap__wood fmap__draw')}
    </g>
    <g class="fmap__layer fmap__layer--fence">
      ${P(fenceD2, 'fmap__ink fmap__ink--faint')}${P(fenceD, 'fmap__ink fmap__ink--fence fmap__draw')}
      ${P(posts(PLAN.fence, 44, 4.5, g), 'fmap__ink fmap__ink--thin')}
      ${P(gateCut, 'fmap__gate-cut')}
      ${P(`M${g.x - g.w / 2} ${g.y - 7}v14M${g.x + g.w / 2} ${g.y - 9}v14`, 'fmap__ink fmap__ink--post')}
    </g>
    <g class="fmap__layer fmap__layer--marks">${P(compass, 'fmap__ink fmap__ink--thin')}${P(scale, 'fmap__ink fmap__ink--thin')}</g>
  </g>`;
}

/** labels (kept at a constant on-screen size and upright when the plan is rotated) */
export function labelArt(): string {
  const sb = PLAN.scale;
  const [cx, cy] = PLAN.compass;
  const [tx, ty] = PLAN.title;
  const items = [
    ...PLAN_LABELS,
    { id: 'north', x: cx, y: cy - 44, text: 'צ', size: 0.9 },
    { id: 'scale', x: sb.x + sb.len / 4, y: sb.y + 22, text: '10 מ׳', size: 0.85 },
    { id: 'title', x: tx, y: ty, text: `${he.brand} · ${he.place}`, size: 1.1 },
    { id: 'moshav', x: 1180, y: 1300, text: he.place, size: 1.05 },
  ];
  return `<g class="fmap__labels" aria-hidden="true">${items.map((l) => `<g class="fmap__label fmap__label--${l.id}" transform="translate(${l.x} ${l.y})"><text class="fmap__label-t" style="--ls:${l.size ?? 1}" text-anchor="middle" dominant-baseline="middle">${l.text}</text></g>`).join('')}</g>`;
}
