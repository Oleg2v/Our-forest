/* "plantDraw" — GSAP's DrawSVG, measured once.
   DrawSVG treats every path with vector-effect="non-scaling-stroke" (all of the stage's lines) as "live": on EVERY
   frame it writes stroke-dasharray, reads getScreenCTM() and getTotalLength() — a forced style + layout per path
   per frame while the tree grows, extras appear or a piece of carpentry draws itself. The stage does not resize in
   the middle of a draw, so here the length is measured once, when the tween starts, and frames only write.
   Same value syntax for what the stage uses ('100%', '0% 12%', '0% 0%'), same dash maths as DrawSVG, so it looks
   the same. A draw that ends fully drawn drops its dash (solid stroke, right at any later size). */
import { gsap } from '../core/gsap';

const NS = (el: Element) => el.getAttribute('vector-effect') === 'non-scaling-stroke';
const num = (v: string) => parseFloat(v) || 0;

function lengthOf(el: SVGGeometryElement): number {
  let sx = 1, sy = 1;
  if (NS(el)) {
    // non-scaling-stroke: the dash is laid out in screen pixels (after transforms), like DrawSVG measures it
    const m = el.getScreenCTM();
    if (m) { sx = Math.hypot(m.a, m.b); sy = Math.hypot(m.c, m.d); }
  }
  let len = 0;
  try { len = el.getTotalLength(); } catch { /* not rendered */ }
  return len * (sx + sy) / 2;
}

/** where the visible part of the stroke is now, from its inline dash (what this plugin or DrawSVG wrote) */
function position(el: SVGGeometryElement, length: number): [number, number] {
  const dashStr = el.style.strokeDasharray;
  const offset = num(el.style.strokeDashoffset);
  if (!dashStr || dashStr === 'none') return [-offset, length - offset];
  const dash = Math.min(length, num(dashStr.split(/[\s,]+/)[0]));
  return [-offset, dash - offset];
}

function parse(value: unknown, length: number, start: number): [number, number] {
  let v = String(value);
  if (v === 'true') v = '0 100%';
  else if (!value) v = '0 0';
  const i = v.indexOf(' ');
  const one = (s: string) => (s.includes('%') ? (num(s) / 100) * length : num(s));
  const a = i < 0 ? start : one(v.slice(0, i));
  const b = one(i < 0 ? v : v.slice(i + 1));
  return a > b ? [b, a] : [a, b];
}

interface DrawData {
  el: SVGGeometryElement; style: CSSStyleDeclaration; length: number;
  s0: number; e0: number; s1: number; e1: number;
  _props: string[];
}

gsap.registerPlugin({
  name: 'plantDraw',
  init(this: DrawData, target: Element, value: unknown) {
    if (!(target instanceof SVGGeometryElement)) return false;
    const length = lengthOf(target);
    const [s0, e0] = position(target, length);
    const [s1, e1] = parse(value, length, s0);
    Object.assign(this, { el: target, style: target.style, length, s0, e0, s1, e1 });
    this._props.push('plantDraw');
    return true;
  },
  render(ratio: number, d: DrawData) {
    const style = d.style;
    const s = d.s0 + (d.s1 - d.s0) * ratio;
    const e = d.e0 + (d.e1 - d.e0) * ratio;
    // fully drawn at the end: no dash at all
    if (ratio === 1 && s <= 0.01 && e >= d.length - 0.01) { style.strokeDasharray = ''; style.strokeDashoffset = ''; return; }
    const dash = e - s || (ratio && ratio !== 1 ? 0.0001 : 0); // zero only at the start or the end (DrawSVG's rule)
    let gap = d.length - dash + 0.1;
    let offset = -s;
    if (dash && offset && dash + Math.abs(offset % d.length) > d.length - 0.05) { offset += offset < 0 ? 0.005 : -0.005; gap += 0.005; }
    style.strokeDashoffset = String(dash ? offset : offset + 0.001);
    style.strokeDasharray = gap < 0.1 ? 'none' : dash ? `${dash}px,${gap}px` : '0px, 999999px';
  },
} as object);

export {};
