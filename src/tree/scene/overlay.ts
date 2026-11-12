/* Shared layers drawn above whichever renderer is active (WebGL or SVG):
   • SVG overlay — moon, flying birds (dawn), a bird landing on a branch after watering,
     greeting-leaf halos with initials, the news dot, the dashed adult silhouette (future),
     the dashed --fruit spot for a sibling tree, the memorial warm glow at the plaque.
   • FX canvas — rain, fireflies, glints of droplets on leaves, hamsin dust.
   Everything uses the same Projector as the 3D, so it sits exactly on the scene. */
import type { Frame } from './types';
import { ISLAND, PLAQUE, sizeOf, growthOf } from './model';
import { P, TINT, css, mixC, clamp, lerp, smooth, hash1, TAU, type V3 } from './util';

const NS = 'http://www.w3.org/2000/svg';
const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
};
const f1 = (v: number) => Math.round(v * 10) / 10;

interface Bird { g: SVGGElement; path: SVGPathElement; x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; size: number; phase: number }

export class Overlay {
  readonly svg: SVGSVGElement;
  readonly fx: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private defs: SVGDefsElement;
  private moon: SVGGElement;
  private stars: SVGGElement;
  private birdsG: SVGGElement;
  private birds: Bird[] = [];
  private nextBirdAt = 1.5;
  private perch: { g: SVGGElement; p: V3; t0: number; dur: number } | null = null;
  private greetG: SVGGElement;
  private greetEls: { g: SVGGElement; halo: SVGCircleElement; text: SVGTextElement; dot: SVGCircleElement }[] = [];
  private news: SVGGElement;
  private ghost: SVGPathElement;
  private sibling: SVGGElement;
  private siblingPath: SVGPathElement;
  private plaqueGlow: SVGEllipseElement;
  private w = 1; private h = 1; private dpr = 1;
  private flies: { x: number; y: number; z: number; ph: number; sp: number }[] = [];
  private drops: { x: number; y: number; l: number; s: number }[] = [];
  private dust: { x: number; y: number; s: number; v: number }[] = [];
  private tmp: V3 = [0, 0, 0];
  private ghostKey = '';

  constructor(root: HTMLElement) {
    this.fx = document.createElement('canvas');
    this.fx.className = 'ts-fx';
    this.fx.setAttribute('aria-hidden', 'true');
    root.appendChild(this.fx);
    this.ctx = this.fx.getContext('2d');
    this.svg = mk('svg', { class: 'ts-ov', 'aria-hidden': 'true', focusable: 'false' });
    root.appendChild(this.svg);
    this.defs = mk('defs', {}, this.svg);
    const halo = mk('radialGradient', { id: 'ts-halo' }, this.defs);
    const gold = css(mixC(TINT.glow, [0.92, 0.74, 0.36], 0.55));
    mk('stop', { offset: '0', 'stop-color': css(mixC(TINT.glow, [1, 0.97, 0.88], 0.5)), 'stop-opacity': '0.95' }, halo);
    mk('stop', { offset: '0.35', 'stop-color': gold, 'stop-opacity': '0.5' }, halo);
    mk('stop', { offset: '1', 'stop-color': gold, 'stop-opacity': '0' }, halo);
    const warm = mk('radialGradient', { id: 'ts-warm' }, this.defs);
    mk('stop', { offset: '0', 'stop-color': '#F8D9A0', 'stop-opacity': '0.9' }, warm);
    mk('stop', { offset: '0.5', 'stop-color': '#F2C27E', 'stop-opacity': '0.4' }, warm);
    mk('stop', { offset: '1', 'stop-color': '#F2C27E', 'stop-opacity': '0' }, warm);
    const moonHalo = mk('radialGradient', { id: 'ts-moonhalo' }, this.defs);
    mk('stop', { offset: '0', 'stop-color': css(mixC(P.sage, P.cream, 0.6)), 'stop-opacity': '0.32' }, moonHalo);
    mk('stop', { offset: '1', 'stop-color': css(P.sage), 'stop-opacity': '0' }, moonHalo);

    this.plaqueGlow = mk('ellipse', { fill: 'url(#ts-warm)', opacity: 0 }, this.svg);
    this.plaqueGlow.style.mixBlendMode = 'soft-light';
    this.stars = mk('g', { opacity: 0 }, this.svg);
    for (let i = 0; i < 9; i++) mk('circle', { r: i % 3 === 0 ? 1.2 : 0.8, fill: css(P.cream) }, this.stars);
    this.moon = mk('g', { opacity: 0 }, this.svg);
    mk('circle', { r: 70, fill: 'url(#ts-moonhalo)' }, this.moon);
    // crescent: outer arc + inner arc (line art)
    mk('path', {
      d: 'M6 -19 A20 20 0 1 0 6 19 A15.5 15.5 0 1 1 6 -19 Z',
      fill: css(mixC(P.cream, P.sage, 0.3)), 'fill-opacity': 0.9, stroke: css(P.cream), 'stroke-width': 1.2, 'stroke-linejoin': 'round',
    }, this.moon);
    this.birdsG = mk('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.svg);
    this.sibling = mk('g', { opacity: 0 }, this.svg);
    this.siblingPath = mk('path', { fill: css(P.fruit), 'fill-opacity': 0.06, stroke: css(P.fruit), 'stroke-width': 1.5, 'stroke-dasharray': '3 5', 'stroke-linecap': 'round' }, this.sibling);
    this.ghost = mk('path', { fill: 'none', 'stroke-width': 1.25, 'stroke-dasharray': '4 6', 'stroke-linecap': 'round', opacity: 0 }, this.svg);
    this.greetG = mk('g', {}, this.svg);
    this.news = mk('g', { opacity: 0 }, this.svg);
    mk('circle', { r: 15, fill: 'url(#ts-halo)' }, this.news);
    mk('circle', { r: 4.2, fill: css(P.olive), stroke: css(P.cream), 'stroke-width': 1.5 }, this.news);

    for (let i = 0; i < 16; i++) this.flies.push({ x: Math.random() * 2 - 1, y: Math.random(), z: Math.random() * 0.8 - 0.4, ph: Math.random() * TAU, sp: 0.6 + Math.random() * 0.8 });
    for (let i = 0; i < 160; i++) this.drops.push({ x: Math.random(), y: Math.random(), l: 0.6 + Math.random() * 0.8, s: 0.8 + Math.random() * 0.5 });
    for (let i = 0; i < 40; i++) this.dust.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.4, v: 0.3 + Math.random() * 0.7 });
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = Math.min(dpr, 2);
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.setAttribute('width', String(w)); this.svg.setAttribute('height', String(h));
    this.fx.width = Math.round(w * this.dpr); this.fx.height = Math.round(h * this.dpr);
  }

  /** a bird lands on a branch for `dur` seconds (watering, ~1 in 3) */
  landBird(f: Frame, dur = 2) {
    if (!f.grow.perches.length || this.perch) return;
    const p = f.grow.perches[Math.floor(Math.random() * f.grow.perches.length)];
    const g = mk('g', { class: 'ts-perch', fill: css(P.cream), stroke: css(f.look.ink), 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.svg);
    mk('path', { d: 'M-8 -5 C-8 -11 -2 -13 4 -12 C9 -11 12 -7 11 -3 C10 1 5 3 -1 3 C-5 3 -8 0 -8 -5Z' }, g);
    mk('path', { d: 'M9 -3 L17 -8 L16 -2 Z' }, g);
    mk('circle', { cx: -7, cy: -12, r: 4.2 }, g);
    mk('path', { d: 'M-11 -12.5 L-14.5 -11.4 L-11 -10.4', fill: 'none' }, g);
    mk('circle', { cx: -8, cy: -13, r: 0.7, fill: css(f.look.ink), stroke: 'none' }, g);
    mk('path', { d: 'M-2 -6 C2 -8 6 -6 8 -3', fill: 'none' }, g);
    mk('path', { d: 'M-2 3 L-3 7 M2 3 L2 7', fill: 'none' }, g);
    this.perch = { g, p, t0: f.time, dur };
  }

  render(f: Frame) {
    const { proj, look, a, state, grow, motion } = f;
    const t = f.time;
    const w = this.w, h = this.h;
    const night = look.night;
    const inkCss = css(look.ink);

    /* moon + stars */
    this.moon.setAttribute('opacity', f1(clamp(night * 1.2 - 0.1) * (1 - look.rain * 0.8) * 10) / 10 + '');
    // phones: below the page's top-left pills ("יש חדש", "דמו"), beside the crown
    const mx = w * (w < h ? 0.13 : 0.16), my = w < h ? Math.max(h * 0.2, 170) : h * 0.17;
    this.moon.setAttribute('transform', `translate(${f1(mx)} ${f1(my)}) scale(${w < h ? 0.85 : 1})`);
    this.stars.setAttribute('opacity', String(f1(clamp(night * 1.3 - 0.3) * (1 - look.rain) * 10) / 10));
    const sc = this.stars.children;
    for (let i = 0; i < sc.length; i++) {
      const sx = hash1(i * 3.1 + 1) * w, sy = hash1(i * 7.7 + 2) * h * 0.32 + h * 0.04;
      sc[i].setAttribute('cx', f1(sx) + ''); sc[i].setAttribute('cy', f1(sy) + '');
      sc[i].setAttribute('opacity', String(f1((motion ? 0.45 + 0.55 * Math.sin(t * (0.6 + hash1(i) * 0.8) + i * 2) : 0.8) * 10) / 10));
    }

    /* flying birds at dawn (and rarely by day) — distant in memorial */
    const birdy = motion ? clamp(look.dawn * 1.6 + look.day * 0.12 - look.rain) : 0;
    if (birdy > 0.15 && t > this.nextBirdAt && this.birds.length < 3) {
      const ltr = Math.random() < 0.5;
      const size = (f.state.mode === 'memorial' ? 0.55 : 1) * (0.8 + Math.random() * 0.5) * (w < 700 ? 0.8 : 1);
      const y0 = h * (0.08 + Math.random() * 0.22);
      const path = mk('path', { stroke: inkCss, 'stroke-width': 1.4 }, this.birdsG);
      const g = this.birdsG as SVGGElement;
      this.birds.push({ g, path, x0: ltr ? -30 : w + 30, x1: ltr ? w + 30 : -30, y0, y1: y0 - h * (0.04 + Math.random() * 0.06), t0: t, dur: (f.state.mode === 'memorial' ? 1.5 : 1) * (9 + Math.random() * 5), size, phase: Math.random() * TAU });
      this.nextBirdAt = t + (1 / Math.max(0.2, birdy)) * (2 + Math.random() * 5);
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      const k = (t - b.t0) / b.dur;
      if (k >= 1) { b.path.remove(); this.birds.splice(i, 1); continue; }
      const x = lerp(b.x0, b.x1, k), y = lerp(b.y0, b.y1, k) + Math.sin(k * 9 + b.phase) * 6;
      const flap = Math.sin(t * 9 + b.phase);
      const wy = lerp(-5.5, 3.5, flap * 0.5 + 0.5) * b.size, ww = 9 * b.size;
      b.path.setAttribute('d', `M${f1(x - ww)} ${f1(y + wy * 0.35)} Q${f1(x - ww * 0.45)} ${f1(y + wy)} ${f1(x)} ${f1(y)} Q${f1(x + ww * 0.45)} ${f1(y + wy)} ${f1(x + ww)} ${f1(y + wy * 0.35)}`);
      b.path.setAttribute('stroke', inkCss);
      b.path.setAttribute('opacity', String(f1(smooth(0, 0.08, k) * (1 - smooth(0.9, 1, k)) * 10) / 10));
    }

    /* perched bird */
    if (this.perch) {
      const pb = this.perch;
      const k = (t - pb.t0);
      const total = pb.dur + 1.5;
      if (k > total || !grow.perches.length) { pb.g.remove(); this.perch = null; }
      else {
        proj.tree(pb.p[0], pb.p[1], pb.p[2], this.tmp);
        const fly = 0.7;
        let x = this.tmp[0], y = this.tmp[1];
        let o = 1;
        if (k < fly) { const e = 1 - Math.pow(1 - k / fly, 3); x += (1 - e) * w * 0.35; y -= (1 - e) * h * 0.18 + Math.sin(e * Math.PI) * 14; o = smooth(0, 0.2, k); }
        else if (k > fly + pb.dur) { const e = Math.pow((k - fly - pb.dur) / (total - fly - pb.dur), 2); x -= e * w * 0.3; y -= e * h * 0.25; o = 1 - smooth(0.6, 1, e); }
        else { const hop = Math.max(0, Math.sin((k - fly) * 5.5)) * (k - fly < 1.2 ? 2.5 : 0); y -= hop; }
        const s = clamp(proj.pxPerUnit(this.tmp[2]) * 0.06, 0.7, 1.4);
        pb.g.setAttribute('transform', `translate(${f1(x)} ${f1(y - 3 * s)}) scale(${f1(s * 10) / 10})`);
        pb.g.setAttribute('opacity', String(f1(o * 10) / 10));
        pb.g.setAttribute('stroke', inkCss);
      }
    }

    /* greeting leaves: halo + initials */
    const gl = f.greetLeaves;
    const greetings = state.greetings ?? [];
    while (this.greetEls.length < greetings.length) {
      const g = mk('g', {}, this.greetG);
      const halo = mk('circle', { r: 20, fill: 'url(#ts-halo)' }, g);
      const dot = mk('circle', { r: 2.2, fill: css(TINT.glow), stroke: css(P.bark), 'stroke-width': 0.8 }, g);
      const text = mk('text', {
        'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'Frank Ruhl Libre', 'David Libre', serif",
        'font-weight': 500, 'font-size': 11, direction: 'rtl',
      }, g);
      this.greetEls.push({ g, halo, text, dot });
    }
    const L = f.model.leaves, s = grow.s;
    for (let i = 0; i < this.greetEls.length; i++) {
      const el = this.greetEls[i];
      const gr = greetings[i];
      const li = gl[i];
      if (!gr || li == null || !state.planted || grow.leafCount === 0) { el.g.setAttribute('opacity', '0'); continue; }
      const len = L.size[li] * 1.35 * Math.pow(s, 0.45);
      const sx = L.x[li] * s + L.dx[li] * len * 0.5, sy = L.y[li] * s + L.dy[li] * len * 0.5, sz = L.z[li] * s + L.dz[li] * len * 0.5;
      proj.tree(sx, sy, sz, this.tmp);
      const ppu = proj.pxPerUnit(this.tmp[2]);
      const r = clamp(len * ppu * 0.9, 10, 30);
      const pulse = a.greetPulse === i ? a.greetPulseA : 0;
      const breathe = gr.glowing ? (motion ? 0.78 + 0.22 * Math.sin(t * 1.9 + i * 1.7) : 0.9) : 0;
      el.g.setAttribute('transform', `translate(${f1(this.tmp[0])} ${f1(this.tmp[1])})`);
      el.g.setAttribute('opacity', '1');
      el.halo.setAttribute('r', f1(r * (1.5 + pulse * 0.6)) + '');
      el.halo.setAttribute('opacity', String(f1((gr.glowing ? breathe * lerp(0.75, 1, night) : pulse * 0.6) * 100) / 100));
      el.text.textContent = gr.glowing ? gr.initials : '';
      el.text.setAttribute('font-size', f1(clamp(r * 0.62, 9, 15)) + '');
      el.text.setAttribute('fill', css(P.bark));
      el.dot.setAttribute('opacity', gr.glowing ? '0' : '1');
    }

    /* news dot above the crown */
    const newsA = state.hasNews && state.planted ? a.news : 0;
    if (newsA > 0.01) {
      proj.tree(grow.crownC[0], grow.top + 0.12, grow.crownC[2], this.tmp);
      const blink = motion ? 0.55 + 0.45 * Math.sin(t * 2.4) : 1;
      this.news.setAttribute('transform', `translate(${f1(this.tmp[0])} ${f1(Math.max(this.tmp[1], 72))})`);
      this.news.setAttribute('opacity', String(f1(newsA * blink * 100) / 100));
    } else this.news.setAttribute('opacity', '0');

    /* sibling spot (dashed --fruit circle on the island) */
    if (a.sibling > 0.01) {
      const sp = f.model.island.sibling;
      let d = '';
      for (let k = 0; k <= 28; k++) {
        const an = (k / 28) * TAU;
        proj.island(sp.x + Math.cos(an) * sp.r, 0.002, sp.z + Math.sin(an) * sp.r * 0.95, this.tmp);
        d += (k ? 'L' : 'M') + f1(this.tmp[0]) + ' ' + f1(this.tmp[1]);
      }
      // a tiny sprout mark in the middle
      proj.island(sp.x, 0, sp.z, this.tmp);
      const cx = this.tmp[0], cy = this.tmp[1];
      const k = clamp(proj.pxPerUnit(this.tmp[2]) * 0.05, 4, 10);
      d += `Z M${f1(cx)} ${f1(cy)} L${f1(cx)} ${f1(cy - k * 1.6)} M${f1(cx)} ${f1(cy - k)} Q${f1(cx - k)} ${f1(cy - k * 1.8)} ${f1(cx - k * 1.3)} ${f1(cy - k * 1.1)} Q${f1(cx - k * 0.4)} ${f1(cy - k * 0.6)} ${f1(cx)} ${f1(cy - k)}`;
      this.siblingPath.setAttribute('d', d);
      this.sibling.setAttribute('opacity', String(f1(a.sibling * (motion ? 0.75 + 0.25 * Math.sin(t * 2) : 1) * 100) / 100));
    } else this.sibling.setAttribute('opacity', '0');

    /* ghost: dashed silhouette of the adult tree */
    if (a.ghost > 0.01) {
      const key = `${f1(ghostScale(f) * 1000)}|${f1(proj.cam.tx * 100)}|${f1(proj.cam.dist * 100)}|${f1(proj.xf.yaw * 1000)}|${f1(proj.xf.tilt * 1000)}|${w}|${h}|${f1(proj.cam.zoom * 100)}|${f1(proj.cam.ty * 100)}|${f1(proj.xf.bob)}`;
      if (key !== this.ghostKey) { this.ghost.setAttribute('d', ghostPath(f, this.tmp)); this.ghostKey = key; }
      this.ghost.setAttribute('stroke', inkCss);
      this.ghost.setAttribute('opacity', String(f1(a.ghost * lerp(0.55, 0.7, night) * 100) / 100));
    } else this.ghost.setAttribute('opacity', '0');

    /* memorial: warm glow at the plaque */
    if (a.plaqueGlow > 0.01 && a.plaqueRise > 0.2) {
      proj.island(PLAQUE.x, PLAQUE.y, PLAQUE.z, this.tmp);
      const ppu = proj.pxPerUnit(this.tmp[2]);
      const breathe = motion ? 0.82 + 0.18 * Math.sin(t * 0.9) : 0.9;
      this.plaqueGlow.setAttribute('cx', f1(this.tmp[0]) + ''); this.plaqueGlow.setAttribute('cy', f1(this.tmp[1]) + '');
      this.plaqueGlow.setAttribute('rx', f1(PLAQUE.w * ppu * 1.05) + ''); this.plaqueGlow.setAttribute('ry', f1(PLAQUE.w * ppu * 0.62) + '');
      this.plaqueGlow.setAttribute('opacity', String(f1(a.plaqueGlow * a.plaqueRise * breathe * lerp(0.55, 0.9, night) * 100) / 100));
    } else this.plaqueGlow.setAttribute('opacity', '0');

    this.renderFx(f);
  }

  private fxDirty = false;
  private renderFx(f: Frame) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { look, a, proj, motion, grow, model } = f;
    const rain = look.rain;
    const night = look.night;
    const glisten = Math.max(a.glisten, rain * 0.6);
    const haze = look.haze;
    const active = (rain > 0.01 || night > 0.3 || glisten > 0.01 || haze > 0.01);
    if (!active) { if (this.fxDirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.fx.width, this.fx.height); this.fxDirty = false; } return; }
    this.fxDirty = true;
    const W = this.w, H = this.h, d = this.dpr, t = f.time;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* rain: fine slanted strokes in ink */
    if (rain > 0.01) {
      const slant = 0.18 + a.wind * 0.35;
      ctx.strokeStyle = css(mixC(look.ink, look.bg, 0.25), 0.32 * rain);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const n = W < 700 ? 90 : 160;
      for (let i = 0; i < n; i++) {
        const dr = this.drops[i];
        const sp = motion ? (t * 1.25 * dr.s + dr.y) % 1 : dr.y;
        const y = sp * (H + 60) - 30, x = (dr.x * (W + 120) - 60 + y * slant) % (W + 120);
        const l = 14 * dr.l;
        ctx.moveTo(x, y); ctx.lineTo(x - l * slant, y - l);
      }
      ctx.stroke();
      // splashes on the island top
      ctx.strokeStyle = css(look.ink, 0.25 * rain);
      for (let i = 0; i < 10 && motion; i++) {
        const ph = (t * 1.6 + hash1(i * 13.3)) % 1;
        const an = hash1(i * 5.1) * TAU, rr = Math.sqrt(hash1(i * 9.7 + Math.floor(t * 1.6 + hash1(i * 13.3)))) * 0.85;
        const x = Math.cos(an) * rr, z = Math.sin(an) * rr * 0.9 - 0.1;
        if (z > ISLAND.ZC - 0.02) continue;
        proj.island(x, 0.004, z, this.tmp);
        const r = ph * 7;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath(); ctx.ellipse(this.tmp[0], this.tmp[1], r, r * 0.3, 0, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* fireflies */
    const ff = clamp(night * 1.4 - 0.4) * (1 - rain * 0.85);
    if (ff > 0.01) {
      const n = f.state.mode === 'memorial' ? 8 : W < 700 ? 11 : 16;
      const cr = Math.max(0.5, grow.crownR * 1.4);
      for (let i = 0; i < n; i++) {
        const q = this.flies[i];
        const tt = motion ? t * 0.25 * q.sp : 0;
        const x = (q.x + Math.sin(tt + q.ph) * 0.18) * cr * 1.1;
        const y = 0.08 + q.y * (grow.top * 0.95 + 0.1) + Math.sin(tt * 1.3 + q.ph * 2) * 0.08;
        const z = ISLAND.ZT + q.z + Math.cos(tt * 0.8 + q.ph) * 0.12;
        proj.island(x, y, z, this.tmp);
        const blink = motion ? Math.pow(0.5 + 0.5 * Math.sin(t * (0.9 + q.sp * 0.7) + q.ph * 3), 3) : 0.6;
        const al = ff * blink;
        if (al < 0.02) continue;
        const r = 9;
        const gr = ctx.createRadialGradient(this.tmp[0], this.tmp[1], 0, this.tmp[0], this.tmp[1], r);
        gr.addColorStop(0, `rgba(246, 236, 170, ${0.9 * al})`);
        gr.addColorStop(0.25, `rgba(232, 222, 140, ${0.35 * al})`);
        gr.addColorStop(1, 'rgba(232, 222, 140, 0)');
        ctx.fillStyle = gr;
        ctx.fillRect(this.tmp[0] - r, this.tmp[1] - r, r * 2, r * 2);
      }
    }

    /* glints of droplets on leaves (after watering, in the rain) */
    if (glisten > 0.01 && grow.leafCount > 0) {
      const L = model.leaves, s = grow.s;
      const n = Math.min(grow.leafCount, W < 700 ? 22 : 34);
      const step = Math.max(1, Math.floor(grow.leafCount / n));
      ctx.lineCap = 'round';
      for (let k = 0, c = 0; k < grow.leafCount && c < n; k += step, c++) {
        const li = grow.leaves[(k * 7) % grow.leafCount];
        proj.tree(L.x[li] * s + L.dx[li] * 0.03, L.y[li] * s + L.dy[li] * 0.03, L.z[li] * s + L.dz[li] * 0.03, this.tmp);
        const tw = motion ? Math.pow(Math.max(0, Math.sin(t * 2.2 + li * 1.37)), 4) : 0.5;
        const al = glisten * (0.25 + 0.75 * tw);
        if (al < 0.05) continue;
        const r = 2 + tw * 3;
        ctx.strokeStyle = night > 0.5 ? `rgba(250, 244, 220, ${al})` : `rgba(255, 252, 240, ${al})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(this.tmp[0] - r, this.tmp[1]); ctx.lineTo(this.tmp[0] + r, this.tmp[1]);
        ctx.moveTo(this.tmp[0], this.tmp[1] - r); ctx.lineTo(this.tmp[0], this.tmp[1] + r);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 253, 245, ${al})`;
        ctx.beginPath(); ctx.arc(this.tmp[0], this.tmp[1], 1.3, 0, TAU); ctx.fill();
      }
    }

    /* hamsin: warm dust drifting */
    if (haze > 0.01) {
      ctx.fillStyle = `rgba(214, 168, 104, ${0.35 * haze})`;
      for (const q of this.dust) {
        const x = ((q.x + (motion ? t * 0.012 * q.v : 0)) % 1) * W;
        const y = (q.y + (motion ? Math.sin(t * 0.4 + q.x * 9) * 0.01 : 0)) * H;
        ctx.beginPath(); ctx.arc(x, y, q.s, 0, TAU); ctx.fill();
      }
    }
  }

  /** draw the overlay into a share image (same projection, current frame) */
  drawInto(ctx: CanvasRenderingContext2D, f: Frame) {
    // fx layer first
    if (this.fxDirty) ctx.drawImage(this.fx, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  dispose() { this.svg.remove(); this.fx.remove(); }
}

/** dashed outline of the adult tree (for share images) */
export function ghostPathFor(f: Frame): string { return ghostPath(f, [0, 0, 0]); }

/** the silhouette's size: the tree at `ghostAgeDays` (the timeline's future), or the adult */
export function ghostScale(f: Frame): number {
  const d = f.state.ghostAgeDays;
  return d == null || !Number.isFinite(d) ? 1 : sizeOf(growthOf(d));
}

/** dashed silhouette of the tree to come, built from its own adult skeleton: a tapering trunk (each stem), the
    main limbs, and the crown's envelope around them — a tree drawn in pencil, not a cloud. Anchored at the trunk base. */
function ghostPath(f: Frame, tmp: V3): string {
  const M = f.model, proj = f.proj, L = M.leaves;
  const gs = ghostScale(f);
  const scr = (x: number, y: number, z: number): [number, number, number] => {
    proj.tree(x * gs, y * gs, z * gs, tmp);
    return [tmp[0], tmp[1], tmp[2]];
  };
  /* crown envelope: radial hull of the adult leaves, smoothed into a calm outline */
  const pts: [number, number][] = [];
  const step = Math.max(1, Math.floor(L.count / 500));
  for (let i = 0; i < L.count; i += step) {
    if (L.tHide[i] < 1.1) continue;
    const q = scr(L.x[i], L.y[i], L.z[i]);
    pts.push([q[0], q[1]]);
  }
  if (pts.length < 8) return '';
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  const N = 40;
  const rad = new Float32Array(N);
  for (const p of pts) {
    const an = Math.atan2(p[1] - cy, p[0] - cx);
    const k = Math.round(((an + Math.PI) / TAU) * N) % N;
    rad[k] = Math.max(rad[k], Math.hypot(p[0] - cx, p[1] - cy));
  }
  let mean = 0;
  for (let k = 0; k < N; k++) mean += rad[k];
  mean /= N;
  for (let k = 0; k < N; k++) rad[k] = Math.max(rad[k], mean * 0.55);
  for (let pass = 0; pass < 6; pass++) {
    const prev = Float32Array.from(rad);
    for (let k = 0; k < N; k++) rad[k] = Math.max(prev[k] * 0.5 + (prev[(k + N - 1) % N] + prev[(k + 1) % N]) * 0.25, prev[k] * 0.9);
  }
  const ppu = proj.pxPerUnit(proj.cam.dist);
  const padPx = M.species.leaf.len * ppu * 0.5 * Math.pow(gs, 0.45);
  const ring: [number, number][] = [];
  for (let k = 0; k < N; k++) {
    const an = (k / N) * TAU - Math.PI;
    const r = rad[k] + padPx;
    ring.push([cx + Math.cos(an) * r, cy + Math.sin(an) * r]);
  }
  let d = '';
  for (let k = 0; k < N; k++) {
    const p0 = ring[(k - 1 + N) % N], p1 = ring[k], p2 = ring[(k + 1) % N], p3 = ring[(k + 2) % N];
    if (!k) d += `M${f1(p1[0])} ${f1(p1[1])}`;
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  d += 'Z';
  const open = (q: [number, number][]) => {
    if (q.length < 2) return '';
    let o = `M${f1(q[0][0])} ${f1(q[0][1])}`;
    for (let k = 0; k < q.length - 1; k++) {
      const p0 = q[Math.max(0, k - 1)], p1 = q[k], p2 = q[k + 1], p3 = q[Math.min(q.length - 1, k + 2)];
      o += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return o;
  };
  /* stems: a tapering trunk outline (two edges), from the ground into the crown */
  const r0 = 0.05 * M.species.trunk.thick * Math.pow(gs, 0.35);
  M.chains.forEach((ch, ci) => {
    if (M.chainOrder[ci] !== 0 || ch.length < 3) return;
    const end = Math.max(2, Math.floor(ch.length * 0.6));
    const line = ch.slice(0, end + 1).map((i) => scr(M.px[i], M.py[i], M.pz[i]));
    for (const side of [-1, 1]) {
      const edge: [number, number][] = line.map((p, k) => {
        const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const rpx = r0 * lerp(1, 0.4, k / (line.length - 1)) * proj.pxPerUnit(p[2]);
        return [p[0] + nx * rpx * side, p[1] + ny * rpx * side];
      });
      d += ' ' + open(edge);
    }
  });
  /* main limbs: the longest first-order branches, as single pencil lines reaching into the crown */
  const limbs = M.chains.map((ch, ci) => ({ ch, ci })).filter((c) => M.chainOrder[c.ci] === 1 && c.ch.length >= 4)
    .sort((a, b) => b.ch.length - a.ch.length).slice(0, 6);
  for (const { ch } of limbs) {
    const par = M.parent[ch[0]];
    const ids = (par >= 0 ? [par] : []).concat(ch.slice(0, Math.max(2, Math.floor(ch.length * 0.7))));
    d += ' ' + open(ids.map((i) => { const q = scr(M.px[i], M.py[i], M.pz[i]); return [q[0], q[1]] as [number, number]; }));
  }
  return d;
}
