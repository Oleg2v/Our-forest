/* ==========================================================================
   SVG renderer — the same tree as a vector engraving. Shown first (fast LCP) and used as the
   complete fallback (no WebGL, weak devices, reduced motion) with all the same actions.
   Geometry is re-projected only when the camera / rotation / growth changes; the breathing,
   floating, wind sway, shake, watering and glows are cheap per-frame attribute updates.
   ========================================================================== */
import type { Frame, Renderer } from '../types';
import type { TreeModel } from '../model';
import { ISLAND, PLAQUE, TOKEN, rootRuns } from '../model';
import { Projector } from '../camera';
import { LEAF_ART, COTYLEDON, BLOSSOM, BELL, GRASS, FRUIT_ART } from '../species';
import { P, TINT, css, mixC, mulC, clamp, lerp, TAU, DEG, type RGB, type V3 } from '../util';

const NS = 'http://www.w3.org/2000/svg';
const XL = 'http://www.w3.org/1999/xlink';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element | null) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
/** set an attribute only when it changes (every write can repaint the SVG layer) */
const sa = (e: Element, k: string, v: string) => { if (e.getAttribute(k) !== v) e.setAttribute(k, v); };
const NIGHT_BG: RGB = mixC(P.moss, P.soil, 0.15);
let instances = 0;

type Pt = [number, number];

export class SvgRenderer implements Renderer {
  readonly kind = 'svg' as const;
  /** wrapper: three stacked SVG layers — island (static), tree (sways as a composited layer), falling leaves */
  readonly el: HTMLDivElement;
  private svgI: SVGSVGElement;
  private svgT: SVGSVGElement;
  private svgF: SVGSVGElement;
  private defs: SVGDefsElement;
  private style: SVGStyleElement;
  private varStyle = '';
  private lastTf = '';
  private lastOrigin = '';
  private lastBob = '';
  private swingOn = false;
  private fallVisible = false;
  private islandG: SVGGElement;
  private treeG: SVGGElement;      // shake / breathe around the base
  private fxG: SVGGElement;        // falling leaves
  private plaqueG: SVGGElement;
  private plaqueImg: SVGImageElement;
  private plaqueClip: SVGRectElement;
  private faceClip: SVGPathElement;
  /** per-instance id prefix: ids and the style sheet are document-global */
  private readonly u = `tsv${++instances}`;
  private tokenImg: SVGImageElement;
  private wetFace: SVGRectElement | null = null;
  private wetSpot: SVGEllipseElement | null = null;
  private capSpot: SVGEllipseElement | null = null;
  private seepRect: SVGRectElement | null = null;
  private rootGlow: SVGPathElement[] = [];
  private seedG: SVGGElement | null = null;
  private crackPaths: SVGPathElement[] = [];
  private limbGroups: { g: SVGGElement[]; px: number; py: number; ph: number; flex: number; side: number }[] = [];
  private fruitEls: { u: SVGUseElement; i: number; x: number; y: number; base: string }[] = [];
  private fallPool: SVGUseElement[] = [];
  private model: TreeModel | null = null;
  private proj = new Projector();
  private key = '';
  private colorSig = '';
  private plaqueVer = -1;
  private tokenSrc = '';
  private tokenCanvas: HTMLCanvasElement | null = null;
  private w = 1; private h = 1;
  private tmp: V3 = [0, 0, 0];
  private baseScreen: Pt = [0, 0];
  private plaqueRest: { a: number; b: number; c: number; d: number; e: number; f: number; groundY: number; liftPx: number } | null = null;
  private lastBuildT = -1;
  private plaqueT = 0;
  private plaqueBusy = false;
  private plaqueUrl = '';
  private disposed = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = `ts-svgwrap ${this.u}`;
    this.el.setAttribute('aria-hidden', 'true');
    const layer = (cls: string) => {
      const sv = el('svg', { class: `ts-svg ${cls}`, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
      sv.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XL);
      this.el.appendChild(sv);
      return sv;
    };
    this.svgI = layer('ts-svg-i'); this.svgT = layer('ts-svg-t'); this.svgF = layer('ts-svg-f');
    this.defs = el('defs', {}, this.svgI);
    this.style = el('style', {}, this.svgI);
    this.style.textContent = svgCss(this.u);
    this.islandG = el('g', {}, this.svgI);
    this.plaqueG = el('g', {}, this.svgI);
    this.treeG = el('g', {}, this.svgT);
    this.fxG = el('g', {}, this.svgF);
    const clip = el('clipPath', { id: `${this.u}-plq` }, this.defs);
    this.plaqueClip = el('rect', { x: -9999, y: -9999, width: 30000, height: 9999 }, clip);
    this.faceClip = el('path', {}, el('clipPath', { id: `${this.u}-face` }, this.defs));
    this.plaqueImg = el('image', { preserveAspectRatio: 'none', width: 1024, height: 427 });
    this.tokenImg = el('image', { preserveAspectRatio: 'none', width: 256, height: 256 });
    this.buildDefs();
    host.appendChild(this.el);
  }

  setModel(m: TreeModel) { this.model = m; this.key = ''; this.buildSymbols(); }

  async init(f: Frame) {
    this.setModel(f.model);
    this.resize(f.w, f.h);
    this.render(f);
  }

  resize(w: number, h: number, _dpr = 1) {
    this.w = w; this.h = h;
    for (const sv of [this.svgI, this.svgT, this.svgF]) {
      sv.setAttribute('viewBox', `0 0 ${w} ${h}`);
      sv.setAttribute('width', String(w)); sv.setAttribute('height', String(h));
    }
    this.key = '';
  }

  /* ------------------------------------------------------------------ defs */
  private buildDefs() {
    const d = this.defs;
    const pat = (id: string, size: number, rot: number, body: string, extra: Record<string, string | number> = {}) => {
      const p = el('pattern', { id, width: size, height: size, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rot})`, ...extra }, d);
      p.innerHTML = body;
      return p;
    };
    pat(`${this.u}-h1`, 4.2, 45, '<line x1="0" y1="0" x2="0" y2="4.2" stroke="currentColor" stroke-width="0.85" stroke-opacity="0.75"/>');
    pat(`${this.u}-h2`, 4.2, -45, '<line x1="0" y1="0" x2="0" y2="4.2" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.65"/>');
    pat(`${this.u}-h3`, 3.4, 45, '<line x1="0" y1="0" x2="0" y2="3.4" stroke="currentColor" stroke-width="0.9" stroke-opacity="0.8"/><line x1="0" y1="0" x2="3.4" y2="0" stroke="currentColor" stroke-width="0.7" stroke-opacity="0.55"/>');
    pat(`${this.u}-stip`, 9, 0, '<circle cx="1.5" cy="2" r="0.75" fill="#EDE5D4" fill-opacity="0.35"/><circle cx="6.2" cy="5.5" r="0.6" fill="#EDE5D4" fill-opacity="0.28"/><circle cx="3.6" cy="7.6" r="0.9" fill="#1d160f" fill-opacity="0.35"/><circle cx="7.8" cy="1.2" r="0.5" fill="#1d160f" fill-opacity="0.3"/><circle cx="4.4" cy="4" r="0.4" fill="#EDE5D4" fill-opacity="0.25"/>');
    pat(`${this.u}-clay`, 14, 0, '<path d="M0 3 Q3.5 1.6 7 3 T14 3 M0 9.5 Q3.5 8.2 7 9.5 T14 9.5" fill="none" stroke="currentColor" stroke-width="0.7" stroke-opacity="0.32"/>');
    pat(`${this.u}-stone`, 7, 0, '<circle cx="2" cy="2" r="0.55" fill="currentColor" fill-opacity="0.3"/><circle cx="5.4" cy="5" r="0.45" fill="currentColor" fill-opacity="0.25"/>');
    pat(`${this.u}-grass`, 8, 0, '<path d="M1 6 l0.6 -2.2 M4.5 3 l-0.5 -2 M6.5 7.5 l0.8 -2" fill="none" stroke="currentColor" stroke-width="0.6" stroke-opacity="0.3" stroke-linecap="round"/>');
    const lfh = pat(`${this.u}-lfh`, 3.2, 30, '<rect width="3.2" height="3.2" style="fill:var(--l3)"/><line x1="0" y1="0" x2="0" y2="3.2" stroke="currentColor" stroke-width="0.9" stroke-opacity="0.55"/>');
    lfh.setAttribute('patternUnits', 'userSpaceOnUse');
    const moist = el('radialGradient', { id: `${this.u}-moist` }, d);
    el('stop', { offset: '0', 'stop-color': '#1c140c', 'stop-opacity': '0.5' }, moist);
    el('stop', { offset: '0.7', 'stop-color': '#1c140c', 'stop-opacity': '0.3' }, moist);
    el('stop', { offset: '1', 'stop-color': '#1c140c', 'stop-opacity': '0' }, moist);
    const seep = el('linearGradient', { id: `${this.u}-seep`, x1: '0', y1: '0', x2: '0', y2: '1' }, d);
    el('stop', { offset: '0', 'stop-color': '#1c140c', 'stop-opacity': '0.3' }, seep);
    el('stop', { offset: '0.85', 'stop-color': '#1c140c', 'stop-opacity': '0.22' }, seep);
    el('stop', { offset: '1', 'stop-color': '#1c140c', 'stop-opacity': '0' }, seep);
    const side = el('linearGradient', { id: `${this.u}-side`, x1: '0', y1: '0', x2: '1', y2: '0' }, d);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0' }, side);
    el('stop', { offset: '0.55', 'stop-color': '#fff', 'stop-opacity': '0.15' }, side);
    el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '1' }, side);
    const m = el('mask', { id: `${this.u}-sidemask`, maskContentUnits: 'objectBoundingBox' }, d);
    el('rect', { width: 1, height: 1, fill: `url(#${this.u}-side)` }, m);
    const sideL = el('linearGradient', { id: `${this.u}-sideL`, x1: '1', y1: '0', x2: '0', y2: '0' }, d);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0' }, sideL);
    el('stop', { offset: '0.55', 'stop-color': '#fff', 'stop-opacity': '0.15' }, sideL);
    el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '1' }, sideL);
    const mL = el('mask', { id: `${this.u}-sidemaskL`, maskContentUnits: 'objectBoundingBox' }, d);
    el('rect', { width: 1, height: 1, fill: `url(#${this.u}-sideL)` }, mL);
    // grass, blossoms, bell, cotyledon, fruits
    el('path', { id: `${this.u}-grass-s`, d: GRASS, fill: 'none', stroke: 'currentColor', 'stroke-width': 5, 'stroke-linecap': 'round' }, d);
    const bl = el('g', { id: `${this.u}-bl` }, d);
    el('path', { d: BLOSSOM.outline, class: 'bl', 'stroke-width': 4 }, bl);
    el('path', { d: BLOSSOM.veins, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-opacity': 0.6 }, bl);
    el('circle', { cx: 50, cy: 50, r: 6, class: 'blc' }, bl);
    const bell = el('g', { id: `${this.u}-bell` }, d);
    el('path', { d: BELL.outline, class: 'fr', 'stroke-width': 4 }, bell);
    el('path', { d: BELL.veins, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-opacity': 0.5 }, bell);
    const cot = el('g', { id: `${this.u}-cot` }, d);
    el('path', { d: COTYLEDON.outline, class: 'cot', 'stroke-width': 4.5 }, cot);
    el('path', { d: COTYLEDON.veins, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-opacity': 0.55 }, cot);
  }

  private buildSymbols() {
    const m = this.model;
    if (!m) return;
    this.defs.querySelector(`#${this.u}-leaf`)?.remove();
    this.defs.querySelector(`#${this.u}-fruit`)?.remove();
    const art = LEAF_ART[m.species.leaf.shape];
    // leaf symbol: fill inherits from the <use> (class), stroke = ink
    const g = el('g', { id: `${this.u}-leaf` }, this.defs);
    el('path', { d: art.outline, 'stroke-width': 4.2, stroke: 'currentColor', 'stroke-linejoin': 'round' }, g);
    el('path', { d: art.veins, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-opacity': 0.55, 'stroke-linecap': 'round' }, g);
    const fg = el('g', { id: `${this.u}-fruit` }, this.defs);
    el('path', { d: FRUIT_ART[m.species.fruit.shape], 'stroke-width': 5, stroke: 'currentColor', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, fg);
  }

  /* ------------------------------------------------------------------ colours (CSS vars) */
  private applyColors(f: Frame) {
    const L = f.look, sp = f.model.species;
    const night = L.night;
    const sh = (c: RGB, k = 1) => mixC(mulC(c, lerp(1, 0.5, night * k)), NIGHT_BG, night * 0.35 * k);
    const ink = mixC(L.bg, L.ink, L.inkA);
    const sig = `${css(ink)}|${Math.round(night * 40)}|${sp.id}|${Math.round(f.season.fresh * 20)}|${f.state.mode}`;
    if (sig === this.colorSig) return;
    this.colorSig = sig;
    const C = sp.colors;
    const fresh = f.season.fresh;
    const fr = (c: RGB) => (fresh > 0 ? mixC(c, mixC(C.light, [0.86, 0.9, 0.62], 0.35), fresh * 0.4) : c);
    const muted = f.state.mode === 'memorial' ? 0.3 : 0;
    const vars: Record<string, RGB> = {
      '--ink': ink,
      '--l0': sh(fr(mixC(C.light, P.cream, 0.18))), '--l1': sh(fr(C.light)), '--l2': sh(fr(C.mid)), '--l3': sh(fr(C.dark)),
      '--a0': sh(C.autumn[0]), '--a1': sh(C.autumn[1 % C.autumn.length]), '--a2': sh(C.autumn[2 % C.autumn.length]), '--a3': sh(mixC(C.autumn[0], P.bark, 0.3)),
      '--lg': mixC(TINT.glow, P.cream, night * 0.3),
      '--bark': sh(C.trunk), '--barkd': sh(mixC(C.trunk, P.bark, 0.4)),
      '--root': sh(mixC(TINT.barkLight, P.bark, 0.25)),
      '--cap': sh(mixC(TINT.grass, P.cream, 0.15)), '--side': sh(mixC(TINT.clay, P.bark, 0.25)),
      '--humus': sh(TINT.humus, 0.6), '--clay': sh(TINT.clay), '--stones': sh(TINT.stones), '--peb': sh(mixC(TINT.stones, P.cream, 0.4)),
      '--fruit': mixC(sh(sp.fruit.color, 0.6), P.sand, muted), '--blossom': sh(sp.bloom?.color ?? TINT.blossom, 0.5),
      '--paper': L.bg, '--cut': sh(mixC(P.cream, P.sand, 0.3), 0.7), '--seed': sh(mixC(TINT.barkLight, P.sand, 0.2)),
      '--wood': sh(mixC(P.bark, P.soil, 0.25)), '--brass': sh(TINT.brass, 0.6),
    };
    let s = '';
    for (const k in vars) { s += `${k}:${css(vars[k])};`; this.el.style.setProperty(k, css(vars[k])); }
    this.el.style.color = css(ink);
    this.varStyle = s + `color:${css(ink)}`;
  }

  /* ------------------------------------------------------------------ render */
  render(f: Frame) {
    if (!this.model || this.model !== f.model) this.setModel(f.model);
    this.applyColors(f);
    // static projection: no bob, no breathe (those are cheap transforms)
    const cam = f.proj.cam, xf = f.proj.xf;
    const key = [
      r1(cam.tx * 300), r1(cam.ty * 300), r1(cam.tz * 300), r1(cam.dist * 300), r1(cam.zoom * 300), Math.round(cam.cx), Math.round(cam.cy),
      Math.round(xf.yaw / DEG * 4), Math.round(xf.tilt / DEG * 4), this.w, this.h, f.grow.version,
      f.state.planted ? 1 : 0, f.state.freshPrune ? 1 : 0, f.state.greetings.length, f.greetLeaves.join(','), Math.round(f.a.crack), Math.round(f.a.prune * 4),
    ].join('|');
    if (key !== this.key) {
      // under heavy re-projection (rotation, camera tweens), keep the frame rate sane on weak devices
      const now = performance.now();
      if (!(this.lastBuildT > 0 && now - this.lastBuildT < 30 && f.dt > 0 && this.key)) {
        this.proj.update({ ...cam }, { yaw: xf.yaw, tilt: xf.tilt, bob: 0, treeScale: 1 });
        this.build(f);
        this.key = key;
        this.lastBuildT = now;
      }
    }
    this.animate(f);
  }

  /* ------------------------------------------------------------------ build (re-project everything) */
  private build(f: Frame) {
    const M = f.model, I = M.island, G = f.grow, P0 = this.proj, t = this.tmp;
    this.islandG.textContent = '';
    this.treeG.textContent = '';
    this.plaqueG.textContent = '';
    this.limbGroups = []; this.fruitEls = []; this.rootGlow = []; this.crackPaths = [];
    const ppu0 = P0.pxPerUnit(P0.cam.dist);
    const isl = (x: number, y: number, z: number): Pt => { P0.island(x, y, z, t); return [t[0], t[1]]; };
    const tre = (x: number, y: number, z: number): Pt => { P0.tree(x, y, z, t); return [t[0], t[1]]; };
    const path = (pts: Pt[], close = true) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join('') + (close ? 'Z' : '');
    const lightLeft = f.look.light[0] < 0;
    const night = f.look.night > 0.5;
    const shadeRight = lightLeft !== night;

    /* ---- island body silhouette ---- */
    const left: Pt[] = [], right: Pt[] = [];
    const LEVELS = 26, SEG = 48;
    for (let li = 0; li <= LEVELS; li++) {
      const s = (li / LEVELS) * 0.999;
      const y = I.yAt(s);
      let mn: Pt | null = null, mx: Pt | null = null;
      for (let k = 0; k < SEG; k++) {
        const a = (k / SEG) * TAU;
        const r = I.radius(a, s);
        const p = isl(Math.cos(a) * r, y, Math.min(ISLAND.ZC, Math.sin(a) * r));
        if (!mn || p[0] < mn[0]) mn = p;
        if (!mx || p[0] > mx[0]) mx = p;
      }
      left.push(mn!); right.push(mx!);
    }
    const bodyD = smoothOpen([...right, ...left.reverse()]) + 'Z';
    el('path', { d: bodyD, class: 'side' }, this.islandG);
    el('path', { d: bodyD, fill: `url(#${this.u}-h1)`, mask: `url(#${shadeRight ? `${this.u}-sidemask` : `${this.u}-sidemaskL`})`, stroke: 'none' }, this.islandG);
    // form lines (meridians) on the earth below the cut
    let mer = '';
    for (let k = 0; k < 14; k++) {
      const a = Math.PI * 0.12 + (k / 13) * Math.PI * 0.76;
      const pts: Pt[] = [];
      for (let li = 2; li <= LEVELS; li += 2) {
        const s = (li / LEVELS) * 0.999, r = I.radius(a, s);
        const z = Math.sin(a) * r;
        if (z > ISLAND.ZC - 0.002) continue;
        pts.push(isl(Math.cos(a) * r, I.yAt(s), z));
      }
      if (pts.length > 2) mer += path(pts, false);
    }
    // also the side meridians facing the camera below the face
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * 0.5 + (k - 4) * 0.2;
      const pts: Pt[] = [];
      for (let li = 2; li <= LEVELS; li++) {
        const s = (li / LEVELS) * 0.999, r = I.radius(a, s);
        const z = Math.sin(a) * r;
        if (z > ISLAND.ZC) continue;
        pts.push(isl(Math.cos(a) * r, I.yAt(s), z));
      }
      if (pts.length > 2) mer += path(pts, false);
    }
    el('path', { d: mer, class: 'form' }, this.islandG);
    el('path', { d: bodyD, class: 'outline' }, this.islandG);

    /* ---- top cap ---- */
    const cap: Pt[] = [];
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * TAU, r = I.rimR(a);
      cap.push(isl(Math.cos(a) * r, 0, Math.min(ISLAND.ZC, Math.sin(a) * r)));
    }
    const capD = smoothPath(cap);
    el('path', { d: capD, class: 'cap' }, this.islandG);
    el('path', { d: capD, fill: `url(#${this.u}-grass)`, stroke: 'none' }, this.islandG);
    // crown shadow (hatched ellipse, stretched along the light)
    if (f.state.planted && G.leafCount + G.chains.length > 0) {
      const L = f.look;
      const sx = -L.light[0] / Math.max(0.25, L.light[1]) * 0.35 * L.shadowLen, sz = -L.light[2] / Math.max(0.3, L.light[1]) * 0.1;
      const cr = Math.min(0.95, G.crownR * 0.9 + 0.08);
      const ccx = G.crownC[0] + sx, ccz = ISLAND.ZT + sz;
      const sh: Pt[] = [];
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU;
        const x = ccx + Math.cos(a) * cr * (1 + Math.abs(sx) * 0.4), z = ccz + Math.sin(a) * cr * 0.55;
        const rr = Math.hypot(x, z), aa = Math.atan2(z, x), lim = I.rimR(aa) * 0.97;
        const k2 = rr > lim ? lim / rr : 1;
        sh.push(isl(x * k2, 0.001, Math.min(ISLAND.ZC - 0.01, z * k2)));
      }
      el('path', { d: smoothPath(sh), fill: `url(#${this.u}-h2)`, opacity: r1(0.75 * L.shadowA * 10) / 10, stroke: 'none' }, this.islandG);
    }
    // moisture spot on the cap
    {
      const c = isl(0, 0.002, ISLAND.ZT);
      const ex = isl(0.6, 0.002, ISLAND.ZT);
      const ez = isl(0, 0.002, ISLAND.ZT - 0.6);
      this.capSpot = el('ellipse', { cx: r1(c[0]), cy: r1(c[1]), rx: r1(Math.abs(ex[0] - c[0])), ry: r1(Math.max(2, Math.abs(ez[1] - c[1]))), fill: `url(#${this.u}-moist)`, opacity: 0 }, this.islandG);
    }
    // grass tufts
    const tuftStep = this.w < 700 ? 2 : 1;
    let tuftsD = '';
    for (let i = 0; i < I.tufts.length; i += tuftStep) {
      const tf = I.tufts[i];
      P0.island(tf.x, 0, tf.z, t);
      const s = tf.s * P0.pxPerUnit(t[2]) / 100;
      tuftsD += tuftPath(t[0], t[1], s * 100, tf.lean);
    }
    el('path', { d: tuftsD, class: 'tuft' }, this.islandG);
    // fallen leaves (autumn / winter, deciduous)
    if (!M.species.evergreen && f.state.planted && (f.season.autumn > 0.3) && G.g > 0.1) {
      const n = Math.round(I.fallen.length * clamp(f.season.autumn) * (f.state.season === 'winter' ? 0.8 : 0.6));
      const lf = el('g', {}, this.islandG);
      for (let i = 0; i < n; i++) {
        const fl = I.fallen[i];
        P0.island(fl.x, 0.003, fl.z, t);
        const len = M.species.leaf.len * fl.s * Math.pow(G.s, 0.45) * P0.pxPerUnit(t[2]) * (M.species.leaf.shape === 'fig' ? 0.75 : 1);
        if (len < 2) continue;
        const sy = Math.sin(P0.cam.pitch + 0.25);
        el('use', { href: `#${this.u}-leaf`, class: `a${Math.floor(fl.c * 4)}`, transform: `translate(${r1(t[0])} ${r1(t[1])}) scale(1 ${r1(sy * 10) / 10}) rotate(${r1(fl.rot / DEG)}) scale(${r1(len / 100 * 100) / 100}) translate(-50 -100)` }, lf);
      }
    }

    /* ---- cut face with the three strata ---- */
    const faceR: Pt[] = I.face.map((row) => isl(row.xr, row.y, ISLAND.ZC));
    const faceL: Pt[] = I.face.map((row) => isl(row.xl, row.y, ISLAND.ZC)).reverse();
    const faceD = smoothOpen([...faceR, ...faceL]) + 'Z';
    this.faceClip.setAttribute('d', faceD);
    const faceG = el('g', { 'clip-path': `url(#${this.u}-face)` }, this.islandG);
    const xs: number[] = [];
    const x0 = I.face[0].xl - 0.05, x1 = I.face[0].xr + 0.05;
    for (let k = 0; k <= 36; k++) xs.push(lerp(x0, x1, k / 36));
    const band = (top: (x: number) => number, bot: (x: number) => number) => {
      const a = xs.map((x) => isl(x, top(x), ISLAND.ZC));
      const b = xs.slice().reverse().map((x) => isl(x, bot(x), ISLAND.ZC));
      return path([...a, ...b]);
    };
    const yb = I.faceBottom - 0.1;
    const humus = band(() => 0.05, I.b1), clay = band(I.b1, I.b2), stones = band(I.b2, () => yb);
    el('path', { d: humus, class: 'humus' }, faceG);
    el('path', { d: humus, fill: `url(#${this.u}-stip)`, stroke: 'none' }, faceG);
    el('path', { d: clay, class: 'clay' }, faceG);
    el('path', { d: clay, fill: `url(#${this.u}-clay)`, stroke: 'none' }, faceG);
    el('path', { d: stones, class: 'stones' }, faceG);
    el('path', { d: stones, fill: `url(#${this.u}-stone)`, stroke: 'none' }, faceG);
    // strata boundaries
    el('path', { d: path(xs.map((x) => isl(x, I.b1(x), ISLAND.ZC)), false) + path(xs.map((x) => isl(x, I.b2(x), ISLAND.ZC)), false), class: 'strata' }, faceG);
    // pebbles
    let pebD = '', pebHi = '';
    for (const pb of I.pebbles) {
      const c = isl(pb.x, pb.y, ISLAND.ZC);
      const rx = pb.rx * ppu0, ry = pb.ry * ppu0;
      const pts: Pt[] = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU, wob = 1 + 0.12 * Math.sin(a * 3 + pb.shade * 9);
        const x = Math.cos(a) * rx * wob, y = Math.sin(a) * ry * wob;
        pts.push([c[0] + x * Math.cos(pb.rot) - y * Math.sin(pb.rot), c[1] + x * Math.sin(pb.rot) + y * Math.cos(pb.rot)]);
      }
      pebD += smoothPath(pts);
      pebHi += `M${r1(c[0] - rx * 0.35)} ${r1(c[1] + ry * 0.55)} Q${r1(c[0] + rx * 0.2)} ${r1(c[1] + ry * 0.8)} ${r1(c[0] + rx * 0.6)} ${r1(c[1] + ry * 0.3)}`;
    }
    el('path', { d: pebD, class: 'peb' }, faceG);
    el('path', { d: pebHi, class: 'pebh' }, faceG);
    // wetness overlays (dark spot from the centre, seep downwards, overall damp)
    this.wetFace = el('rect', { x: 0, y: 0, width: this.w, height: this.h, fill: '#1c140c', opacity: 0 }, faceG);
    const fc = isl(0, 0, ISLAND.ZC);
    this.wetSpot = el('ellipse', { cx: r1(fc[0]), cy: r1(fc[1]), rx: 1, ry: 1, fill: `url(#${this.u}-moist)`, opacity: 0 }, faceG);
    this.seepRect = el('rect', { x: r1(isl(-1, 0, ISLAND.ZC)[0]), y: r1(fc[1]), width: r1(2 * ppu0), height: 0, fill: `url(#${this.u}-seep)`, opacity: 0 }, faceG);
    // the seed lies in the soil cut (before planting / birth)
    {
      const sc = isl(0, ISLAND.SEED_Y, ISLAND.ZC);
      const rr = 0.034 * ppu0;
      const sg = el('g', { transform: `translate(${r1(sc[0])} ${r1(sc[1])})` }, faceG);
      el('ellipse', { rx: r1(rr * 1.9), ry: r1(rr * 1.35), class: 'chamber' }, sg);
      const inner = el('g', {}, sg);
      el('path', { d: `M${-rr} 0 C${-rr} ${-rr * 0.75} ${rr * 0.2} ${-rr * 0.78} ${rr} ${-rr * 0.12} C${rr * 1.05} ${rr * 0.35} ${rr * 0.3} ${rr * 0.72} ${-rr * 0.3} ${rr * 0.62} C${-rr * 0.8} ${rr * 0.55} ${-rr} ${rr * 0.3} ${-rr} 0Z`, class: 'seed' }, inner);
      for (let k = 0; k < 3; k++) {
        const a0 = -Math.PI / 2 + (k - 1) * 0.9;
        let d = `M${r1(Math.cos(a0) * rr * 0.15)} ${r1(Math.sin(a0) * rr * 0.12)}`;
        for (let q = 1; q <= 4; q++) {
          const rq = rr * (0.15 + q * 0.2), aq = a0 + (q % 2 ? 0.25 : -0.25);
          d += ` L${r1(Math.cos(aq) * rq)} ${r1(Math.sin(aq) * rq * 0.8)}`;
        }
        this.crackPaths.push(el('path', { d, class: 'crack', 'stroke-dasharray': '1', pathLength: 1, 'stroke-dashoffset': 1 }, inner));
      }
      this.seedG = sg;
    }
    // roots
    this.buildRoots(f, faceG, isl);
    el('path', { d: faceD, class: 'outline face' }, this.islandG);
    // the top edge of the cut gets a slightly stronger line
    el('path', { d: path([faceL[faceL.length - 1], faceR[0]].map((p) => p) as Pt[], false), class: 'outline edge' }, this.islandG);
    el('path', { d: capD, class: 'outline rim' }, this.islandG);

    /* ---- plaque + token ---- */
    this.buildPlaque(f);

    /* ---- the tree ---- */
    if (f.state.planted) this.buildTree(f, tre, shadeRight);
    this.baseScreen = tre(0, 0, 0);
  }

  private buildRoots(f: Frame, parent: SVGGElement, isl: (x: number, y: number, z: number) => Pt) {
    const G = f.grow;
    if (!f.state.planted || G.rootReveal <= 0) return;
    const runs = rootRuns(f.model, G);
    if (!runs.length) return;
    const ppu = this.proj.pxPerUnit(this.proj.cam.dist);
    const back = el('g', { class: 'roots' }, parent);
    const glowG = el('g', { class: 'rglow' }, parent);
    const fills: { d: string; w: number }[] = [];
    const minW = lerp(0.7, 0.5, G.radicle);
    const draw = (pts: Pt[], w: number) => {
      const d = smoothOpen(pts);
      fills.push({ d, w });
      const gp = el('path', { d, class: 'rg', 'stroke-width': r1(w + 3.2), pathLength: 1, 'stroke-dasharray': '0 1 0 2' }, glowG);
      this.rootGlow.push(gp);
    };
    for (const run of runs) {
      const pts: Pt[] = run.map((q) => isl(q.x, q.y, ISLAND.ZC + 0.004));
      // birth close-up: the underground stem bends to the sprout's base (the trunk stands just behind the cut)
      if (G.radicle > 0.05 && run[0].d === 0) pts.unshift(isl(0, 0.001, lerp(ISLAND.ZC, ISLAND.ZT, G.radicle)));
      if (G.radicle > 0.05 && run.length > 3) {
        // a growing radicle tapers: draw it in a few pieces, thick at the seed, hair-thin at the tip
        const n = Math.min(4, run.length - 1);
        for (let k = 0; k < n; k++) {
          const a = Math.floor((k * (pts.length - 1)) / n), b = Math.floor(((k + 1) * (pts.length - 1)) / n);
          const qa = run[Math.min(run.length - 1, a)], qb = run[Math.min(run.length - 1, b)];
          draw(pts.slice(a, b + 1), Math.max(minW, (qa.r + qb.r) * ppu));
        }
        continue;
      }
      let wSum = 0;
      for (const q of run) wSum += q.r;
      draw(pts, Math.max(minW, (wSum / run.length) * ppu * 2));
    }
    // outlined roots: ink stroke then a lighter core
    for (const r of fills) el('path', { d: r.d, class: 'ro', 'stroke-width': r1(r.w + 1.7) }, back);
    for (const r of fills) if (r.w > 1.6) el('path', { d: r.d, class: 'rf', 'stroke-width': r1(r.w - 0.2) }, back);
  }

  private buildPlaque(f: Frame) {
    const P0 = this.proj, t = this.tmp;
    const g = this.plaqueG;
    // stakes into the soil (visible in the cut)
    const stakes = el('g', { class: 'stake' }, g);
    for (const sx of [-0.13, 0.13]) {
      const top = P0.island(PLAQUE.x + sx, PLAQUE.y - PLAQUE.h * 0.3, PLAQUE.z - 0.004, [0, 0, 0]);
      const bot = P0.island(PLAQUE.x + sx, -0.2, ISLAND.ZC + 0.005, [0, 0, 0]);
      const wpx = 0.014 * P0.pxPerUnit(top[2]);
      el('path', { d: `M${r1(top[0] - wpx)} ${r1(top[1])} L${r1(bot[0] - wpx * 0.8)} ${r1(bot[1])} L${r1(bot[0])} ${r1(bot[1] + wpx)} L${r1(bot[0] + wpx * 0.8)} ${r1(bot[1])} L${r1(top[0] + wpx)} ${r1(top[1])}Z` }, stakes);
    }
    // token post
    {
      const top = P0.island(TOKEN.x, TOKEN.y, TOKEN.z - 0.006, [0, 0, 0]);
      const bot = P0.island(TOKEN.x, -0.12, ISLAND.ZC + 0.005, [0, 0, 0]);
      el('path', { d: `M${r1(top[0])} ${r1(top[1])} L${r1(bot[0])} ${r1(bot[1])}`, class: 'post' }, g);
    }
    const inner = el('g', { 'clip-path': `url(#${this.u}-plq)` }, g);
    // affine from the image rect (1024×427) to the projected plaque corners
    const cor = (u: number, v: number) => {
      const yaw = PLAQUE.yaw, tilt = PLAQUE.tilt;
      const lx = u * PLAQUE.w, ly = v * PLAQUE.h;
      const x = PLAQUE.x + lx * Math.cos(yaw), z = PLAQUE.z - lx * Math.sin(yaw) - ly * Math.sin(tilt);
      const y = PLAQUE.y + ly * Math.cos(tilt);
      return P0.island(x, y, z, [0, 0, 0]);
    };
    const p00 = cor(-0.5, 0.5), p10 = cor(0.5, 0.5), p01 = cor(-0.5, -0.5);
    const W = 1024, H = 427;
    const a = (p10[0] - p00[0]) / W, b = (p10[1] - p00[1]) / W, c = (p01[0] - p00[0]) / H, d = (p01[1] - p00[1]) / H;
    // thickness: a darker edge under the plank
    const edge = el('g', {}, inner);
    const pts = [cor(-0.5, -0.5), cor(0.5, -0.5), cor(0.5, 0.5), cor(-0.5, 0.5)];
    const th = Math.max(1.5, 0.012 * P0.pxPerUnit(pts[0][2]));
    el('path', { d: `M${r1(pts[0][0] + th * 0.4)} ${r1(pts[0][1] + th)} L${r1(pts[1][0] + th * 0.4)} ${r1(pts[1][1] + th)} L${r1(pts[1][0])} ${r1(pts[1][1] - PLAQUE.h * 0.3 * P0.pxPerUnit(pts[1][2]))} L${r1(pts[0][0])} ${r1(pts[0][1] - PLAQUE.h * 0.3 * P0.pxPerUnit(pts[0][2]))}Z`, class: 'wood' }, edge);
    inner.appendChild(this.plaqueImg);
    const m = { a, b, c, d, e: p00[0], f: p00[1] };
    this.plaqueImg.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
    // outline of the plank in the brand leaf shape
    const R = 0.3, rr = 0.06; // fractions of height (as the wood texture)
    const ol = plankOutline(R, rr).map(([u, v]) => cor(u, v)).map((p) => [p[0], p[1]] as Pt);
    el('path', { d: ol.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join('') + 'Z', class: 'plq' }, inner);
    // token
    const tc = P0.island(TOKEN.x, TOKEN.y, TOKEN.z, [0, 0, 0]);
    const tr = TOKEN.r * P0.pxPerUnit(tc[2]);
    const tg = el('g', {}, inner);
    tg.appendChild(this.tokenImg);
    this.tokenImg.setAttribute('transform', `translate(${r1(tc[0] - tr)} ${r1(tc[1] - tr)}) scale(${(tr * 2) / 256})`);
    el('circle', { cx: r1(tc[0]), cy: r1(tc[1]), r: r1(tr), class: 'tok' }, tg);
    const ground = P0.island(PLAQUE.x, 0, PLAQUE.z, [0, 0, 0]);
    this.plaqueRest = { ...m, groundY: ground[1], liftPx: Math.abs(p01[1] - ground[1]) + PLAQUE.h * 0.3 * P0.pxPerUnit(p01[2]) + 4 };
    this.plaqueVer = -1;
    void t;
  }

  private buildTree(f: Frame, tre: (x: number, y: number, z: number) => Pt, shadeRight: boolean) {
    const M = f.model, G = f.grow, P0 = this.proj, t = this.tmp;
    const ppu = (x: number, y: number, z: number) => { P0.tree(x, y, z, t); return P0.pxPerUnit(t[2]); };
    // limbs: each chain belongs to its order-1 ancestor chain (or the trunk) — those sway together
    const nodeChain = new Int32Array(M.n).fill(-1);
    G.chains.forEach((ch, ci) => { for (let k = ch.length > 1 && M.parent[ch[0]] >= 0 && ch[0] !== ch[1] ? 1 : 0; k < ch.length; k++) if (nodeChain[ch[k]] < 0) nodeChain[ch[k]] = ci; });
    const limbOfChain = new Int32Array(G.chains.length).fill(0);
    const limbs: { g: SVGGElement[]; px: number; py: number; ph: number; flex: number; side: number }[] = [];
    const limbId = new Map<number, number>();
    G.chains.forEach((ch, ci) => {
      // walk up to the chain whose order is 1 (or 0)
      let c = ci, guard = 0;
      while (G.chainOrd[c] > 1 && guard++ < 10) {
        const attach = ch.length ? M.parent[G.chains[c][1] ?? G.chains[c][0]] : -1;
        const pc = attach >= 0 ? nodeChain[attach] : -1;
        if (pc < 0 || pc === c) break;
        c = pc;
      }
      if (!limbId.has(c)) {
        const first = G.chains[c][0];
        const p = tre(G.x[first], G.y[first], G.z[first]);
        limbId.set(c, limbs.length);
        limbs.push({ g: [], px: p[0], py: p[1], ph: M.phase[first] ?? 0, flex: G.chainOrd[c] === 0 ? 0.25 : 1, side: Math.sign(G.x[G.chains[c][G.chains[c].length - 1]] - G.x[first]) || 1 });
      }
      limbOfChain[ci] = limbId.get(c)!;
    });
    const layers = [el('g', { class: 'back' }, this.treeG), el('g', { class: 'branches' }, this.treeG), el('g', { class: 'front' }, this.treeG)];
    const limbG = (li: number, layer: number) => {
      const L = limbs[li];
      if (!L.g[layer]) L.g[layer] = el('g', {}, layers[layer]);
      return L.g[layer];
    };

    /* branches: tapered outlined polygons + hatched shadow side + bark lines */
    const order = G.chains.map((_, i) => i).sort((a, b) => G.chainOrd[b] - G.chainOrd[a]);
    const thin: string[] = [];
    for (const ci of order) {
      const ch = G.chains[ci];
      const c: Pt[] = [], r: number[] = [];
      for (const i of ch) {
        P0.tree(G.x[i], G.y[i], G.z[i], t);
        c.push([t[0], t[1]]); r.push(Math.max(0.35, G.r[i] * P0.pxPerUnit(t[2])));
      }
      if (c.length < 2) continue;
      const lg = limbG(limbOfChain[ci], 1);
      const maxR = Math.max(...r);
      if (maxR < 1.1) { thin.push(smoothOpen(c)); continue; }
      // widths taper to the tip
      r[r.length - 1] *= 0.55;
      const { left, right } = offsets(c, r);
      const body = smoothPath([...left, ...right.reverse()]);
      el('path', { d: body, class: 'br' }, lg);
      if (maxR > 2.2) {
        const sideOff = offsets(c, r.map((x, k) => (shadeRight ? 1 : -1) * x * 0.05));
        const shadowEdge = shadeRight ? offsets(c, r).right : offsets(c, r).left;
        const sh = smoothPath([...(shadeRight ? sideOff.right : sideOff.left), ...shadowEdge.slice().reverse()]);
        el('path', { d: sh, fill: maxR > 5 ? `url(#${this.u}-h3)` : `url(#${this.u}-h1)`, stroke: 'none' }, lg);
        // bark lines along the limb
        const lines = maxR > 6 ? [0.55, 0.78, -0.3] : [0.6];
        let bd = '';
        for (const k of lines) {
          const o = offsets(c, r.map((x) => (shadeRight ? 1 : -1) * x * k)).left;
          bd += smoothOpen(o.filter((_, i) => i < o.length - 1));
        }
        el('path', { d: bd, class: 'barkl' }, lg);
      }
      el('path', { d: body, class: 'brl' }, lg);
    }
    if (thin.length) el('path', { d: thin.join(''), class: 'twig' }, layers[1]);

    // fresh cuts after pruning
    if (f.a.prune > 0.3) {
      for (const ps of M.pruneSites) {
        if (!G.vis[ps.node]) continue;
        const i = ps.node;
        const base = tre(G.x[i], G.y[i], G.z[i]);
        const rr = G.r[i] * 0.75;
        const tip = tre(G.x[i] + ps.dir[0] * rr * 2.2, G.y[i] + ps.dir[1] * rr * 2.2, G.z[i] + ps.dir[2] * rr * 2.2);
        const rpx = Math.max(1.6, rr * ppu(G.x[i], G.y[i], G.z[i]));
        const g = el('g', { class: 'cut' }, layers[1]);
        el('path', { d: `M${r1(base[0])} ${r1(base[1])} L${r1(tip[0])} ${r1(tip[1])}`, 'stroke-width': r1(rpx * 2), class: 'stub' }, g);
        el('ellipse', { cx: r1(tip[0]), cy: r1(tip[1]), rx: r1(rpx), ry: r1(rpx * 0.7), class: 'cutface', transform: `rotate(${r1(Math.atan2(tip[1] - base[1], tip[0] - base[0]) / DEG + 90)} ${r1(tip[0])} ${r1(tip[1])})` }, g);
      }
    }

    /* leaves */
    const L = M.leaves;
    // a subset of the leaves (vector leaves are heavier than instanced ones)
    const target = M.species.leaf.shape === 'fig' ? 240 : M.species.leaf.shape === 'olive' ? 700 : 480;
    const stride = Math.max(1, Math.ceil(G.leafCount / target));
    const sizeK = 1 + Math.min(0.45, (stride - 1) * 0.08);
    const spK = ({ olive: 1.12, pomegranate: 1.08, almond: 1, carob: 1.05, fig: 1, mulberry: 1 } as Record<string, number>)[M.species.leaf.shape] ?? 1;
    const light = f.look.light;
    const greet = new Set(f.greetLeaves.slice(0, f.state.greetings.length));
    const camF: V3 = [0, -Math.sin(P0.cam.pitch), -Math.cos(P0.cam.pitch)];
    const s = G.s;
    for (let k = 0; k < G.leafCount; k++) {
      const li = G.leaves[k];
      const isG = greet.has(li);
      if (!isG && (k % stride) !== 0) continue;
      const len = L.size[li] * G.leafScale[k] * (isG ? 1.2 : sizeK * spK);
      const bx = L.x[li] * s, by = L.y[li] * s, bz = L.z[li] * s;
      const b = tre(bx, by, bz);
      P0.tree(bx, by, bz, t);
      const depth = t[2];
      const tp = tre(bx + L.dx[li] * len, by + L.dy[li] * len, bz + L.dz[li] * len);
      const lpx = Math.hypot(tp[0] - b[0], tp[1] - b[1]);
      const full = len * P0.pxPerUnit(depth);
      if (full < 1.2) continue;
      const ang = Math.atan2(tp[1] - b[1], tp[0] - b[0]) / DEG + 90;
      const facing = Math.abs(L.nx[li] * camF[0] + L.ny[li] * camF[1] + L.nz[li] * camF[2]);
      const sy = clamp(lpx / full, 0.35, 1) * full / 100;
      const sx = clamp(0.35 + facing * 0.75, 0.35, 1) * full / 100;
      // tone: light on the blade + position in the crown
      const ndl = L.nx[li] * light[0] + L.ny[li] * light[1] + L.nz[li] * light[2];
      const ox = L.x[li] - M.crownC[0], oy = L.y[li] - M.crownC[1], oz = L.z[li] - M.crownC[2];
      const ol = Math.hypot(ox, oy, oz) || 1;
      const odl = (ox * light[0] + oy * light[1] + oz * light[2]) / ol;
      const tone = clamp(0.35 * Math.abs(ndl) + 0.45 * (odl * 0.5 + 0.5) + 0.3 * L.ao[li] - 0.12 + (L.r3[li] - 0.5) * 0.25);
      let cls: string;
      if (isG) cls = 'lg';
      else if (G.leafAutumn[k] > 0.5) cls = `a${Math.floor(L.r3[li] * 3.99)}`;
      else cls = tone > 0.68 ? 'l0' : tone > 0.5 ? 'l1' : tone > 0.3 ? 'l2' : 'l3';
      const front = L.z[li] > M.crownC[2] * 1 + 0.02 || isG;
      const ci = nodeChain[L.node[li]];
      const lg = limbG(ci >= 0 ? limbOfChain[ci] : 0, front ? 2 : 0);
      el('use', { href: `#${this.u}-leaf`, class: cls, transform: `translate(${r1(b[0])} ${r1(b[1])}) rotate(${r1(ang)}) scale(${r1(sx * 1000) / 1000} ${r1(sy * 1000) / 1000}) translate(-50 -100)` }, lg);
    }
    // seedling leaves
    if (G.cotyledon) {
      const c = G.cotyledon;
      const b = tre(c.x, c.y, c.z);
      const pxs = c.size * ppu(c.x, c.y, c.z) / 100;
      const open = c.open;
      for (const side of [-1, 1]) {
        el('use', { href: `#${this.u}-cot`, class: 'l1', transform: `translate(${r1(b[0])} ${r1(b[1])}) rotate(${r1(side * lerp(8, 62, open))}) scale(${r1(pxs * lerp(0.55, 1, open) * 1000) / 1000} ${r1(pxs * 1000) / 1000}) translate(-50 -100)` }, layers[2]);
      }
    }

    /* fruits & blossoms (front layer) */
    const FR = M.fruits;
    for (let k = 0; k < G.fruitCount; k++) {
      const i = FR.node.length ? G.fruits[k] : 0;
      const x = G.fruitXYZ[k * 3], y = G.fruitXYZ[k * 3 + 1], z = G.fruitXYZ[k * 3 + 2];
      const p = tre(x, y, z);
      const sz = FR.size[i] * G.fruitScale[k] * ppu(x, y, z) / 100;
      if (sz * 100 < 1.5) continue;
      const ci = nodeChain[FR.node[i]];
      const lg = limbG(ci >= 0 ? limbOfChain[ci] : 0, z > M.crownC[2] * s ? 2 : 0);
      const base = `translate(${r1(p[0])} ${r1(p[1] - sz * 50)})`;
      const u = el('use', { href: `#${this.u}-fruit`, class: 'fr', transform: `${base} rotate(${r1(FR.rot[i] / DEG)}) scale(${r1(sz * 1000) / 1000}) translate(-50 -8)` }, lg);
      this.fruitEls.push({ u, i, x: p[0], y: p[1] - sz * 50, base: `scale(${r1(sz * 1000) / 1000}) translate(-50 -8)` });
    }
    const BL = M.blossoms;
    if (G.blossomCount && M.species.bloom) {
      const bell = M.species.bloom.bell;
      const step = Math.max(1, Math.floor(G.blossomCount / 160));
      for (let k = 0; k < G.blossomCount; k += step) {
        const i = G.blossoms[k];
        const x = G.blossomXYZ[k * 3], y = G.blossomXYZ[k * 3 + 1], z = G.blossomXYZ[k * 3 + 2];
        const p = tre(x, y, z);
        const sz = BL.size[i] * G.blossomScale[k] * ppu(x, y, z) / 100 * (bell ? 1 : 1.15);
        if (sz * 100 < 1.5) continue;
        const ci = nodeChain[BL.node[i]];
        const lg = limbG(ci >= 0 ? limbOfChain[ci] : 0, z > M.crownC[2] * s ? 2 : 0);
        el('use', { href: bell ? `#${this.u}-bell` : `#${this.u}-bl`, transform: `translate(${r1(p[0])} ${r1(p[1])}) rotate(${r1(BL.rot[i] / DEG * 2)}) scale(${r1(sz * 1000) / 1000}) translate(-50 ${bell ? -96 : -50})` }, lg);
      }
    }
    this.limbGroups = limbs;
  }

  /* ------------------------------------------------------------------ per-frame animation */
  private animate(f: Frame) {
    const { a, motion } = f;
    const t = f.time;
    const P0 = this.proj;
    // float (bob), wind sway, shake and breathing are compositor-only transforms of whole layers
    const ppu = P0.pxPerUnit(P0.cam.dist);
    const bobPx = f.proj.xf.bob * ppu;
    const bob = `translate3d(0, ${r1(-bobPx * 10) / 10}px, 0)`;
    if (bob !== this.lastBob) { this.el.style.transform = bob; this.lastBob = bob; }
    const [bx, by] = this.baseScreen;
    const origin = `${r1(bx)}px ${r1(by)}px`;
    if (origin !== this.lastOrigin) { this.svgT.style.transformOrigin = origin; this.lastOrigin = origin; }
    const sway = motion ? (Math.sin(t * 1.1) * 0.6 + Math.sin(t * 2.3 + 1.1) * 0.25) * (0.3 + a.wind * 2.2) * 0.7 : 0;
    const deg = sway + a.shake * 2.2;
    const tf = `rotate(${r1(deg * 100) / 100}deg) scale(${r1(a.breathe * (1 + a.lift * 0.006) * 1000) / 1000})`;
    if (tf !== this.lastTf) { this.svgT.style.transform = tf; this.lastTf = tf; }
    // fruit swing (tap) — only while swinging
    if (a.fruitSwingA > 0.001 || this.swingOn) {
      this.swingOn = a.fruitSwingA > 0.001;
      for (const fe of this.fruitEls) {
        const sw = fe.i === a.fruitSwing ? Math.sin(t * 9) * 18 * a.fruitSwingA : 0;
        fe.u.setAttribute('transform', `translate(${r1(fe.x)} ${r1(fe.y)}) rotate(${r1(sw)}) ${fe.base}`);
      }
    }
    // plaque rise + texture
    if (this.plaqueRest) {
      const pr = this.plaqueRest;
      const dy = (1 - a.plaqueRise) * pr.liftPx;
      sa(this.plaqueG, 'transform', dy > 0.2 ? `translate(0 ${r1(dy)})` : '');
      sa(this.plaqueG, 'opacity', a.plaqueRise < 0.01 ? '0' : '1');
      // clip at the ground line (in the moving group's coordinates)
      sa(this.plaqueClip, 'height', String(Math.round(Math.max(0, 9999 + pr.groundY - dy + 1) * 10) / 10));
    }
    if (f.plaque.version !== this.plaqueVer && !this.plaqueBusy && (this.plaqueVer < 0 || a.plaqueRise > 0.01)) {
      // the engraving texture: encoded off the main thread (toBlob) and throttled during the burn — a synchronous
      // PNG toDataURL of the 1024 px plank every ~110 ms blocked whole seconds of the birth on a slow device
      const now = performance.now();
      if (this.plaqueVer < 0 || now - this.plaqueT > 110) {
        const ver = f.plaque.version, cv = f.plaque.canvas;
        this.plaqueT = now;
        this.plaqueBusy = true;
        const done = (b: Blob | null) => {
          this.plaqueBusy = false;
          this.plaqueVer = ver;
          if (!b || this.disposed) return;
          const url = URL.createObjectURL(b);
          this.plaqueImg.setAttribute('href', url);
          const old = this.plaqueUrl;
          this.plaqueUrl = url;
          if (old) window.setTimeout(() => URL.revokeObjectURL(old), 1500);
        };
        try {
          if (typeof cv.toBlob === 'function') cv.toBlob(done, 'image/png');
          else { this.plaqueImg.setAttribute('href', cv.toDataURL('image/png')); this.plaqueBusy = false; this.plaqueVer = ver; }
        } catch { this.plaqueBusy = false; this.plaqueVer = ver; }
      }
    }
    if (this.tokenSrc === '' || this.tokenCanvas !== f.token) {
      this.tokenCanvas = f.token;
      try { this.tokenSrc = f.token.toDataURL('image/png'); this.tokenImg.setAttribute('href', this.tokenSrc); } catch { /* ignore */ }
    }
    // watering (attributes change only while something moves)
    if (this.wetFace) sa(this.wetFace, 'opacity', String(r1(f.a.wet * 0.22 * 100) / 100));
    if (this.wetSpot) {
      const r = a.spot * 0.85 * ppu;
      sa(this.wetSpot, 'rx', String(r1(Math.max(1, r * 1.1)))); sa(this.wetSpot, 'ry', String(r1(Math.max(1, r * 0.7))));
      sa(this.wetSpot, 'opacity', a.spot > 0.01 ? '1' : '0');
    }
    if (this.capSpot) {
      sa(this.capSpot, 'opacity', String(r1(clamp(a.spot * 1.4) * 100) / 100));
      const cx = this.capSpot.getAttribute('cx'), cy = this.capSpot.getAttribute('cy');
      sa(this.capSpot, 'transform', `translate(${cx} ${cy}) scale(${r1(Math.max(0.01, a.spot) * 100) / 100}) translate(${-Number(cx)} ${-Number(cy)})`);
    }
    if (this.seepRect) {
      const h = a.seep * (Math.abs(f.model.island.faceBottom) + 0.1) * ppu;
      sa(this.seepRect, 'height', String(r1(h)));
      sa(this.seepRect, 'opacity', a.seep > 0.001 && a.seep < 0.999 ? '1' : a.seep >= 0.999 ? '0.6' : '0');
    }
    const ga = a.rootGlowA;
    for (const p of this.rootGlow) {
      if (ga < 0.01) { sa(p, 'opacity', '0'); continue; }
      const pr = clamp(a.rootGlow);
      sa(p, 'opacity', String(r1(ga * 100) / 100));
      sa(p, 'stroke-dasharray', `0 ${r1((1 - pr) * 1000) / 1000} ${r1(pr * 1000) / 1000} 2`);
    }
    // seed (the pulse is quantised so the island layer repaints rarely)
    if (this.seedG) {
      sa(this.seedG, 'opacity', String(r1(a.seed * 100) / 100));
      if (a.seed > 0.01) {
        const pulse = motion ? 1 + 0.06 * Math.sin(t * 2.6) * (f.state.planted ? 0 : 1) + a.seedPulse * 0.06 : 1;
        const tr = this.seedG.getAttribute('transform')!.replace(/ scale\([^)]*\)/, '');
        sa(this.seedG, 'transform', `${tr} scale(${Math.round(pulse * 200) / 200})`);
        this.crackPaths.forEach((p, i) => sa(p, 'stroke-dashoffset', String(r1((1 - clamp(a.crack - i)) * 100) / 100)));
      }
    }
    this.renderFalling(f);
  }

  private renderFalling(f: Frame) {
    const P0 = f.proj, t = this.tmp;
    const list = f.falling;
    if (!list.length && !this.fallVisible) return;
    this.fallVisible = list.length > 0;
    while (this.fallPool.length < list.length) this.fallPool.push(el('use', { href: `#${this.u}-leaf` }, this.fxG));
    for (let i = 0; i < this.fallPool.length; i++) {
      const u = this.fallPool[i];
      const p = list[i];
      if (!p) { if (u.getAttribute('opacity') !== '0') u.setAttribute('opacity', '0'); continue; }
      P0.island(p.x, p.y, p.z, t);
      const len = p.size * P0.pxPerUnit(t[2]) / 100;
      const flat = p.landed >= 0 ? Math.sin(P0.cam.pitch + 0.25) : 0.55 + 0.45 * Math.cos(p.tilt * 2);
      u.setAttribute('transform', `translate(${r1(t[0])} ${r1(t[1] - f.proj.xf.bob * 0)}) scale(1 ${r1(flat * 100) / 100}) rotate(${r1(p.rot / DEG)}) scale(${r1(len * 1000) / 1000}) translate(-50 -60)`);
      u.setAttribute('style', `fill:${css(p.color)}`);
      u.setAttribute('href', p.petal ? `#${this.u}-bl` : `#${this.u}-leaf`);
      u.setAttribute('opacity', r1(p.alpha * 100) / 100 + '');
    }
  }

  /* ------------------------------------------------------------------ snapshot */
  async snapshot(f: Frame, w: number, h: number): Promise<HTMLCanvasElement | null> {
    // render a detached copy at w×h with the share projection, rasterise via <img>
    const tmp = new SvgRenderer(document.createElement('div'));
    tmp.resize(w, h);
    tmp.setModel(f.model);
    tmp.applyColors(f);
    tmp.proj.update({ ...f.proj.cam }, { ...f.proj.xf, bob: 0 });
    tmp.build(f);
    tmp.key = 'snap';
    try { tmp.plaqueImg.setAttribute('href', f.plaque.canvas.toDataURL('image/png')); tmp.tokenImg.setAttribute('href', f.token.toDataURL('image/png')); } catch { /* ignore */ }
    tmp.animate({ ...f, a: { ...f.a, shake: 0, breathe: 1 }, motion: false });
    // one standalone SVG: the colour variables on the root, island then tree
    const root = el('svg', { xmlns: NS, viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: tmp.u, style: tmp.varStyle });
    root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XL);
    for (const c of [...tmp.svgI.childNodes, ...tmp.svgT.childNodes]) root.appendChild(c.cloneNode(true));
    const xml = new XMLSerializer().serializeToString(root);
    tmp.dispose();
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg raster')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')?.drawImage(img, 0, 0, w, h);
    return c;
  }

  dispose() {
    this.disposed = true;
    this.el.remove();
    if (this.plaqueUrl) { const u = this.plaqueUrl; this.plaqueUrl = ''; window.setTimeout(() => URL.revokeObjectURL(u), 1500); }
  }
}

/* ------------------------------------------------------------------ geometry helpers */
function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + 'Z';
}
function smoothOpen(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  if (n === 2) return d + `L${r1(pts[1][0])} ${r1(pts[1][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}
/** left/right offset polylines of a centreline with per-point half widths */
function offsets(c: Pt[], r: number[]) {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    left.push([c[i][0] + nx * r[i], c[i][1] + ny * r[i]]);
    right.push([c[i][0] - nx * r[i], c[i][1] - ny * r[i]]);
  }
  return { left, right };
}
function tuftPath(x: number, y: number, s: number, lean: number): string {
  if (s < 2) return '';
  const k = s / 100;
  const blades = [[-14, -46], [6, -58], [-3, -50], [18, -32], [-22, -26]];
  let d = '';
  for (const [bx, by] of blades) {
    const ex = x + (bx + lean * 30) * k, ey = y + by * k;
    d += `M${r1(x)} ${r1(y)}Q${r1(x + (bx * 0.2 + lean * 10) * k)} ${r1(y + by * 0.55 * k)} ${r1(ex)} ${r1(ey)}`;
  }
  return d;
}
/** the plank's leaf outline in (u, v) ∈ [-0.5, 0.5]², big radius top-left & bottom-right */
function plankOutline(R: number, r: number): [number, number][] {
  const asp = 2.4;
  const pts: [number, number][] = [];
  const arc = (cx: number, cy: number, rad: number, from: number, to: number) => {
    for (let k = 0; k <= 6; k++) { const a = lerp(from, to, k / 6); pts.push([cx + (Math.cos(a) * rad) / asp, cy + Math.sin(a) * rad]); }
  };
  arc(-0.5 + R / asp, 0.5 - R, R, Math.PI, Math.PI / 2);            // top-left
  arc(0.5 - r / asp, 0.5 - r, r, Math.PI / 2, 0);                    // top-right
  arc(0.5 - R / asp, -0.5 + R, R, 0, -Math.PI / 2);                  // bottom-right
  arc(-0.5 + r / asp, -0.5 + r, r, -Math.PI / 2, -Math.PI);          // bottom-left
  return pts;
}

const svgCss = (u: string) => `
.${u}{overflow:visible}
.${u} .side{fill:var(--side);stroke:none}
.${u} .form{fill:none;stroke:currentColor;stroke-width:.7;stroke-opacity:.28;stroke-linecap:round}
.${u} .outline{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
.${u} .outline.rim{stroke-width:1.3}
.${u} .outline.edge{stroke-width:1.9}
.${u} .cap{fill:var(--cap);stroke:none}
.${u} .tuft{fill:none;stroke:currentColor;stroke-width:.9;stroke-opacity:.7;stroke-linecap:round}
.${u} .humus{fill:var(--humus)}
.${u} .clay{fill:var(--clay)}
.${u} .stones{fill:var(--stones)}
.${u} .strata{fill:none;stroke:currentColor;stroke-width:1;stroke-opacity:.55;stroke-dasharray:6 3 1.5 3}
.${u} .peb{fill:var(--peb);stroke:currentColor;stroke-width:.9}
.${u} .pebh{fill:none;stroke:currentColor;stroke-width:.6;stroke-opacity:.45}
.${u} .chamber{fill:var(--humus);stroke:currentColor;stroke-width:.6;stroke-opacity:.35;stroke-dasharray:2 2}
.${u} .seed{fill:var(--seed);stroke:currentColor;stroke-width:1.3}
.${u} .crack{fill:none;stroke:currentColor;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.${u} .ro{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}
.${u} .rf{fill:none;stroke:var(--root);stroke-linecap:round;stroke-linejoin:round}
.${u} .rg{fill:none;stroke:#F6DFA4;stroke-linecap:round;stroke-linejoin:round;opacity:0;mix-blend-mode:screen}
.${u} .br{fill:var(--bark);stroke:none}
.${u} .brl{fill:none;stroke:currentColor;stroke-width:1.15;stroke-linejoin:round}
.${u} .barkl{fill:none;stroke:currentColor;stroke-width:.6;stroke-opacity:.5;stroke-linecap:round}
.${u} .twig{fill:none;stroke:currentColor;stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.${u} use{stroke:currentColor}
.${u} .l0{fill:var(--l0)}.${u} .l1{fill:var(--l1)}.${u} .l2{fill:var(--l2)}.${u} .l3{fill:url(#${u}-lfh)}
.${u} .a0{fill:var(--a0)}.${u} .a1{fill:var(--a1)}.${u} .a2{fill:var(--a2)}.${u} .a3{fill:var(--a3)}
.${u} .lg{fill:var(--lg)}
.${u} .fr{fill:var(--fruit)}
.${u} .bl{fill:var(--blossom);stroke:currentColor}
.${u} .blc{fill:var(--fruit)}
.${u} .cot{fill:var(--l1);stroke:currentColor}
.${u} .stake path{fill:var(--wood);stroke:currentColor;stroke-width:.9}
.${u} .post{stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
.${u} .wood{fill:var(--wood);stroke:currentColor;stroke-width:1}
.${u} .plq{fill:none;stroke:currentColor;stroke-width:1.3;stroke-linejoin:round}
.${u} .tok{fill:none;stroke:currentColor;stroke-width:1.1}
.${u} .stub{stroke:var(--bark);stroke-linecap:butt}
.${u} .cutface{fill:var(--cut);stroke:currentColor;stroke-width:1}
`;
