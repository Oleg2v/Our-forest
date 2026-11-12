/* ==========================================================================
   Home 3 — "מתחת לפני השטח" (under the ground). Markup: partials/home/roots.html
   ONE motion idea: the root grows with your scroll.
   • Desktop + motion ('pinned'): a pinned stage (~320vh of scroll). The camera
     descends through a cross-section — cream surface → soil — while a root
     grows from the sapling in the photo (DrawSVG, scrubbed), branches to the
     five directions, each node lighting up (ring + icon draw themselves, title
     and caption rise). At the end the light gathers from the five nodes into
     the tap root, the branches dim, and one bright line rises up and out while
     the camera follows it a little — the roots converge into one line that
     leads upward. Rare fireflies in the soil. The dog lives in the dogs node.
   • Phone ('mobile'): no pin; one vertical root line through the section,
     drawn to the scroll position; nodes light up in turn as the tip reaches them.
   • Reduced motion ('static' / 'mobile-static'): no pin, roots fully drawn,
     everything visible, simple fades.
   Everything is rebuilt from the measured layout on resize / breakpoint /
   motion change, so the lines always meet the HTML nodes exactly.
   ========================================================================== */
import './roots.css';
import { gsap, ScrollTrigger, SplitText } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { sound } from '../../core/sound';
import { he } from '../../content/he';
import { mountDog, type DogHandle } from '../../components/dog';
import { scrollTo } from '../../core/scroll';
import { whenScrollQuiet } from './preloader';
import {
  seeded, smoothPath, pebble, samplePath, lengthAtY, pointAt, rootlet, surfaceMarkup,
  type P, type Rand, type Sample,
} from './roots-geometry';

const NS = 'http://www.w3.org/2000/svg';
type Mode = 'pinned' | 'static' | 'mobile' | 'mobile-static';

/** Initialise every tween of an animation now and put it back where it was: DrawSVG measures its paths
    (getTotalLength, getBBox, computed stroke styles) the first time a tween renders — done here, in an init slot,
    not as a forced style + layout in the middle of a scroll frame when a node lights up. */
function prime(a: gsap.core.Animation) {
  if (a.isActive()) return; // already playing: it initialised itself
  const p = a.progress();
  a.progress(1, true).progress(p, true);
}

/** sine.inOut as a CSS timing function (compositor animations) */
const SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/* ---------------- the soil grain, rendered once ----------------
   The grain is an SVG feTurbulence (roots.css, --roots-grain-svg). Painted as a CSS background, an SVG image is
   re-rendered — filter included — on every paint of every tile it touches; on iPhones that ran a turbulence filter
   per tile per scroll frame under the growing root. Here the same SVG is drawn ONCE into a canvas at the screen's
   pixel ratio and handed back as a plain raster tile (blob URL in --roots-grain): the browser's own pixels, no filter
   at paint time. If anything fails (old engine, tainted canvas) the CSS keeps the SVG. */
let grainTile: Promise<string | null> | null = null;
function renderGrain(section: HTMLElement): Promise<string | null> {
  grainTile ??= (async () => {
    const m = /url\(\s*(["']?)(data:[^]*?)\1\s*\)/.exec(getComputedStyle(section).getPropertyValue('--roots-grain-svg'));
    if (!m) return null;
    const img = new Image();
    img.src = m[2];
    await img.decode();
    // the one turbulence render + PNG encode (tens of ms on a phone): never under the finger
    if (env.isTouch) await new Promise<void>((res) => whenScrollQuiet(res));
    const s = Math.min(3, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
    const c = document.createElement('canvas');
    c.width = c.height = 260 * s;
    const x = c.getContext('2d');
    if (!x) return null;
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    return blob ? URL.createObjectURL(blob) : null;
  })().catch(() => null);
  return grainTile;
}

interface Box { x: number; y: number; w: number; h: number; cx: number; cy: number; bottom: number }
/** where the reader is, recorded before a rebuild (motion toggle) and restored after it */
type Place =
  | { part: 'below'; el: HTMLElement; top: number }
  | { part: 'story'; top: number; t: number }
  | { part: 'net'; el: HTMLElement; top: number };

/** Keep the static markup in sync with the single source of copy (src/content/he.ts). */
function syncCopy(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-he]').forEach((el) => {
    const v = el.dataset.he!.split('.').reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), he);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });
}

/* ---------------- desktop timeline layout (in timeline units) ---------------- */
const TL = {
  descentAt: 1.5, descentDur: 2.8,   // story hold, then the dive under the ground
  netAt: 4.2,
  branchEvery: 0.9, branchDur: 1.0,
  tapNetDur: 3.8,          // tap root: from the descent tip down to the deepest node
  glowAt: 9.0, glowDur: 1.2, branchGlowDur: 0.6,
  riseAt: 10.0, riseDur: 1.2, // the branches dim, one bright line carries on up while the camera follows it a little
  end: 11.5,
  allLit: 8.95,            // where #directions lands (just before the finale)
};
const PIN_VH = 2.5;        // pinned scroll distance in viewport heights (section ≈ 350vh)
/** Phone layout (one vertical root): phones, and landscape phones / very short windows, where a pinned
    100vh cross-section with five nodes cannot fit. Keep in sync with the @media block in roots.css. */
const COMPACT_MQ = '(max-width: 768px), (max-height: 560px) and (orientation: landscape)';
const isCompact = () => window.matchMedia(COMPACT_MQ).matches;

class Roots {
  s: HTMLElement;
  stage: HTMLElement; world: HTMLElement; ground: HTMLElement; surface: HTMLElement;
  frame: HTMLElement; img: HTMLElement | null; art: SVGSVGElement | null;
  copy: HTMLElement; eyebrow: HTMLElement; title: HTMLElement; text: HTMLElement;
  net: HTMLElement; netTitle: HTMLElement; nodes: HTMLElement[];
  lines: SVGSVGElement; flies: HTMLElement; anchor: HTMLElement;
  mode: Mode | null = null;
  ctx: gsap.Context | null = null;
  dog: DogHandle | null = null;
  disposers: (() => void)[] = [];
  /** pinned mode: the pin and its timeline length (for mapping a reading position into it) */
  pin: ScrollTrigger | null = null;
  tlDur = TL.end;
  /** animations to initialise in a quiet slot of their own (see prime / primeAll) */
  unprimed: gsap.core.Animation[] = [];
  gen = 0;

  constructor(s: HTMLElement) {
    this.s = s;
    const q = <T extends Element = HTMLElement>(sel: string) => s.querySelector(sel) as T;
    this.stage = q('.roots__stage'); this.world = q('.roots__world'); this.ground = q('.roots__ground');
    this.surface = q('.roots__surface'); this.frame = q('.roots__frame');
    this.img = s.querySelector<HTMLElement>('.roots__img'); this.art = s.querySelector<SVGSVGElement>('.roots__art');
    this.copy = q('.roots__copy'); this.eyebrow = q('.roots__eyebrow'); this.title = q('.roots__title'); this.text = q('.roots__text');
    this.net = q('.roots__net'); this.netTitle = q('.roots__net-title');
    this.nodes = Array.from(s.querySelectorAll<HTMLElement>('.roots__node'));
    this.lines = q<SVGSVGElement>('.roots__lines'); this.flies = q('.roots__flies'); this.anchor = q('.roots__anchor');
    if (this.img && !this.img.hasAttribute('data-img-pending')) this.frame.classList.add('roots__frame--real');
  }

  pickMode(): Mode {
    const mobile = isCompact();
    const motion = env.motionAllowed();
    if (mobile) return motion ? 'mobile' : 'mobile-static';
    return motion ? 'pinned' : 'static';
  }

  mount() {
    this.mode = this.pickMode();
    this.s.classList.add(`roots--${this.mode}`);
    this.ctx = gsap.context(() => {
      if (this.mode === 'pinned') this.setupPinned();
      else if (this.mode === 'mobile') this.setupMobile();
      else this.setupStatic();
    }, this.s);
    // touch devices: the DrawSVG measuring gets its own scroll-quiet slot (a phone's init stays short);
    // whatever lights up before that simply initialises itself, as it always did
    const gen = ++this.gen;
    if (env.isTouch) whenScrollQuiet(() => { if (gen === this.gen) this.primeAll(); });
    else this.primeAll();
  }

  /** queue an animation for priming (returns it, for chaining) */
  prime<A extends gsap.core.Animation>(a: A): A { this.unprimed.push(a); return a; }
  primeAll() { this.unprimed.splice(0).forEach(prime); }

  teardown() {
    this.gen++;
    this.unprimed.length = 0;
    this.disposers.splice(0).forEach((f) => f());
    this.dog?.destroy();
    this.dog = null;
    this.ctx?.revert();
    this.ctx = null;
    this.lines.replaceChildren();
    this.flies.replaceChildren();
    this.surface.replaceChildren();
    this.s.classList.remove('roots--pinned', 'roots--static', 'roots--mobile', 'roots--mobile-static');
    this.anchor.removeAttribute('id');
    this.anchor.removeAttribute('tabindex');
    this.anchor.style.top = '';
    this.pin = null;
  }

  /* ------------- keep the reader's place across a rebuild (the a11y "stop animations" switch) -------------
     Turning the pin off removes ~2.5 screens of pin spacing; turning it on adds them back. Without this the
     reader, at the same scrollY, lands in the next section — exactly the people who press that switch. */
  capturePlace(): Place | null {
    const vh = window.innerHeight;
    const line = vh * 0.42; // the reading line
    const r = this.s.getBoundingClientRect();
    if (r.top > line) return null; // reading above the section: nothing above the reader moves
    if (r.bottom < line) {
      // reading further down: keep the section under the reading line where it is
      // (elementsFromPoint: the a11y panel that holds the switch may be open over the page)
      // The outermost <section> across the reading line (not a pin-spacer wrapper — a section that unpins on the
      // same switch removes it). Geometry, not hit-testing: the a11y dialog that holds the switch makes the page inert.
      const el = Array.from(document.querySelectorAll<HTMLElement>('main section, footer'))
        .filter((n) => !n.parentElement?.closest('main section'))
        .find((n) => { const b = n.getBoundingClientRect(); return b.top <= line && b.bottom > line; }) ?? null;
      return el && !this.s.contains(el) ? { part: 'below', el, top: el.getBoundingClientRect().top } : null;
    }
    if (this.pin) {
      const t = this.pin.progress * this.tlDur;
      if (t < TL.descentAt + TL.descentDur * 0.5) return { part: 'story', top: this.copy.getBoundingClientRect().top, t };
      return { part: 'net', el: this.netTitle, top: this.netTitle.getBoundingClientRect().top };
    }
    // unpinned layouts: the story copy, the net title or the node nearest the reading line
    const cands = [this.netTitle, ...this.nodes];
    const netTop = this.netTitle.getBoundingClientRect().top;
    if (netTop > line) return { part: 'story', top: this.copy.getBoundingClientRect().top, t: TL.descentAt * 0.85 };
    let best = this.netTitle, d = Infinity;
    for (const el of cands) { const dd = Math.abs(el.getBoundingClientRect().top - line); if (dd < d) { d = dd; best = el; } }
    return { part: 'net', el: best, top: best.getBoundingClientRect().top };
  }

  restorePlace(p: Place) {
    const vh = window.innerHeight;
    const go = (y: number) => { if (Math.abs(y - window.scrollY) > 1) scrollTo(Math.max(0, Math.round(y)), { immediate: true, offset: 0 }); };
    const keep = (el: HTMLElement, top: number) => go(window.scrollY + el.getBoundingClientRect().top - top);
    if (p.part === 'below') { keep(p.el, p.top); return; }
    if (this.pin) {
      // into the pinned timeline: the story with its words read, or the net with all five nodes lit
      const t = p.part === 'story' ? Math.min(p.t, TL.descentAt) : TL.allLit;
      go(this.pin.start + (t / this.tlDur) * (this.pin.end - this.pin.start));
      return;
    }
    const clampTop = (v: number) => Math.min(Math.max(v, 72), vh * 0.6);
    if (p.part === 'story') keep(this.copy, clampTop(p.top));
    else if (p.el === this.netTitle || this.nodes.includes(p.el)) keep(p.el, clampTop(p.top));
  }

  /** layout fingerprint (transform-independent) — rebuild only when it really changed */
  signature(): string {
    return [this.copy, this.title, this.netTitle, this.frame, ...this.nodes].map((el) => `${el.offsetTop}:${el.offsetHeight}:${el.offsetWidth}`).join('|');
  }

  rebuild(place: Place | null = null) {
    this.teardown();
    this.mount();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    if (place) {
      this.restorePlace(place);
      // once more after the other sections' own rebuilds and refreshes have settled
      requestAnimationFrame(() => requestAnimationFrame(() => { this.restorePlace(place); ScrollTrigger.update(); }));
    }
  }

  /* ============================== geometry ============================== */
  box(el: Element, wr: DOMRect): Box {
    const r = el.getBoundingClientRect();
    const x = r.left - wr.left, y = r.top - wr.top;
    return { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2, bottom: y + r.height };
  }

  sizeLines(): { W: number; Hw: number; wr: DOMRect } {
    const wr = this.world.getBoundingClientRect();
    const W = Math.round(wr.width), Hw = Math.round(wr.height);
    this.lines.setAttribute('viewBox', `0 0 ${W} ${Hw}`);
    this.lines.setAttribute('width', String(W));
    this.lines.setAttribute('height', String(Hw));
    return { W, Hw, wr };
  }

  path(d: string, cls: string, parent: Element = this.lines): SVGPathElement {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    parent.append(p);
    return p;
  }

  group(cls: string): SVGGElement {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', cls);
    this.lines.append(g);
    return g;
  }

  drawSurface(rand: Rand) {
    const w = this.surface.clientWidth || this.s.clientWidth;
    const h = this.surface.clientHeight || 56;
    this.surface.innerHTML = surfaceMarkup(w, h, rand, isCompact() ? { amp: 5, tufts: 70 } : { amp: 7, tufts: 120 });
  }

  /** Faint soil details: pebbles + dotted strata, kept away from text boxes. */
  drawSoil(rand: Rand, W: number, Hw: number, groundTop: number, avoid: Box[], count: number) {
    const g = this.group('roots__soil');
    const hit = (x: number, y: number, pad: number) => avoid.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.bottom + pad);
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 20) {
      const x = rand.range(W * 0.03, W * 0.97);
      const y = rand.range(groundTop + 40, Hw - 30);
      if (hit(x, y, 26)) continue;
      this.path(pebble(x, y, rand.range(2.5, 8), rand), 'roots__pebble', g);
      made++;
    }
    const strata = Math.max(2, Math.round((Hw - groundTop) / 520));
    for (let i = 0; i < strata; i++) {
      const y0 = groundTop + ((i + 0.6) / strata) * (Hw - groundTop);
      const pts: P[] = [];
      for (let x = -40; x <= W + 40; x += 160) pts.push({ x, y: y0 + rand.range(-14, 14) });
      this.path(smoothPath(pts), 'roots__stratum', g);
    }
  }

  /** Rare fireflies: soft breathing glows that drift a little. Paused off-screen.
      Compositor animations (WAAPI, transform + opacity): no main-thread work per frame, smooth even while the page
      is busy. Same timing as the GSAP version they replace: a breath (in, dip, back, out) then a 3–9 s rest, and a
      6–10 s drift that eases back and forth; the same seeded values in the same order, so the same flies. */
  makeFlies(rand: Rand, count: number, zone: { x0: number; x1: number; y0: number; y1: number }) {
    const anims: Animation[] = [];
    const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'roots__fly';
      this.flies.append(el);
      const x = rand.range(zone.x0, zone.x1), y = rand.range(zone.y0, zone.y1);
      const peak = rand.range(0.5, 0.95);
      const rest = rand.range(3, 9), delay = rand.range(0, 8);
      const rise = rand.range(1.2, 1.8), fall = rand.range(1.6, 2.4);
      const dx = rand.range(-36, 36), dy = rand.range(-28, 18), drift = rand.range(6, 10);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (!canAnimate) continue;
      const cycle = rise + 0.7 + 0.6 + fall + rest;
      const at = (t: number) => t / cycle;
      anims.push(el.animate([
        { offset: 0, opacity: 0, easing: SINE },
        { offset: at(rise), opacity: peak, easing: SINE },
        { offset: at(rise + 0.7), opacity: peak * 0.55, easing: SINE },
        { offset: at(rise + 1.3), opacity: peak, easing: SINE },
        { offset: at(rise + 1.3 + fall), opacity: 0 },
        { offset: 1, opacity: 0 },
      ], { duration: cycle * 1000, delay: delay * 1000, iterations: Infinity, fill: 'backwards' }));
      anims.push(el.animate([
        { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` },
        { transform: `translate3d(${(x + dx).toFixed(1)}px, ${(y + dy).toFixed(1)}px, 0)` },
      ], { duration: drift * 1000, iterations: Infinity, direction: 'alternate', easing: SINE }));
    }
    anims.forEach((a) => a.pause());
    this.disposers.push(() => anims.forEach((a) => a.cancel()));
    ScrollTrigger.create({
      trigger: this.s, start: 'top bottom', end: 'bottom top',
      onToggle: (st) => anims.forEach((a) => (st.isActive ? a.play() : a.pause())),
    });
  }

  /** The fine root that carries on past a node — outwards, clear of the centred label. */
  tipPath(node: HTMLElement, N: Box, side: number): string {
    const r = N.w / 2;
    const label = Math.max(...Array.from(node.querySelectorAll<HTMLElement>('.roots__node-title, .roots__node-text')).map((e) => e.offsetWidth)) / 2;
    const out = Math.max(r + 60, label + 34);
    return smoothPath([
      { x: N.cx + side * r * 0.72, y: N.cy + r * 0.7 },
      { x: N.cx + side * (r + 34), y: N.cy + r + 6 },
      { x: N.cx + side * out, y: N.cy + r + 30 },
      { x: N.cx + side * (out + 16), y: N.cy + r + 96 },
    ]);
  }

  /* -------- desktop root system (shared by 'pinned' and 'static') -------- */
  buildDesktop() {
    const rand = seeded(427);
    this.drawSurface(rand);
    const { W, Hw, wr } = this.sizeLines();
    const H = window.innerHeight;
    const frame = this.box(this.frame, wr);
    const net = this.box(this.net, wr);
    const ground = this.box(this.ground, wr);
    const dots = this.nodes.map((n) => this.box(n.querySelector('.roots__dot')!, wr));
    const deep = dots[4];

    this.drawSoil(rand, W, Hw, ground.y, [
      this.box(this.copy, wr), frame, this.box(this.netTitle, wr), ...this.nodes.map((n) => this.box(n, wr)),
    ], Math.round(W / 34));

    // tap root: from the sapling (photo bottom) through the soil to the deepest node
    const O: P = { x: frame.cx + 4, y: frame.bottom - 12 };
    const J: P = { x: deep.cx, y: net.y + net.h * 0.04 };
    const span = J.y - O.y;
    const tapPts: P[] = [
      O,
      { x: O.x - 6, y: O.y + span * 0.16 },
      { x: O.x + (J.x - O.x) * 0.22 + rand.range(-10, 10), y: O.y + span * 0.42 },
      { x: O.x + (J.x - O.x) * 0.68 + rand.range(-10, 10), y: O.y + span * 0.74 },
      J,
    ];
    const below = deep.cy - J.y;
    for (const k of [0.22, 0.46, 0.7]) tapPts.push({ x: deep.cx + rand.range(-14, 14), y: J.y + below * k });
    tapPts.push({ x: deep.cx, y: deep.cy });
    const tapD = smoothPath(tapPts);
    const tap = this.path(tapD, 'roots__root roots__root--tap');
    const { total: tapLen, samples: tapS } = samplePath(tap, 5);

    // sapling's first fine roots, around the origin
    const sap = [
      this.path(smoothPath([O, { x: O.x - 26, y: O.y + 34 }, { x: O.x - 58, y: O.y + 70 }, { x: O.x - 70, y: O.y + 118 }]), 'roots__root roots__root--thin'),
      this.path(smoothPath([O, { x: O.x + 22, y: O.y + 30 }, { x: O.x + 50, y: O.y + 58 }, { x: O.x + 64, y: O.y + 104 }]), 'roots__root roots__root--thin'),
    ];

    // lateral roots to nodes 1–4, leaving the tap root at increasing depths
    const fracs = [0.14, 0.24, 0.4, 0.54];
    const branches = dots.slice(0, 4).map((N, i) => {
      const lenB = lengthAtY(tapS, J.y + (deep.cy - J.y) * fracs[i]);
      const B = pointAt(tapS, lenB).p;
      const dx = N.cx - B.x, dy = N.cy - B.y;
      const side = Math.sign(dx) || 1;
      const pts: P[] = [
        B,
        { x: B.x + dx * 0.26, y: B.y + dy * 0.1 + 8 },
        { x: B.x + dx * 0.6 + rand.range(-10, 10), y: B.y + dy * 0.36 + rand.range(-6, 6) },
        { x: B.x + dx * 0.9 + rand.range(-5, 5), y: B.y + dy * 0.74 },
        { x: N.cx, y: N.cy },
      ];
      const d = smoothPath(pts);
      const path = this.path(d, 'roots__root');
      const { total, samples } = samplePath(path, 6);
      // the root goes on past the node, finer, outwards and down
      const tip = i === 1 ? null : this.path(this.tipPath(this.nodes[i], N, side), 'roots__root roots__root--thin roots__root--tip');
      return { path, d, total, samples, lenB, B, side, tip };
    });
    const deepTip = this.path(this.tipPath(this.nodes[4], deep, -1), 'roots__root roots__root--thin roots__root--tip');

    // fine rootlets (timed by where they leave their parent)
    const rootlets: { path: SVGPathElement; parent: number; at: number }[] = [];
    const addRootlets = (samples: Sample[], total: number, parent: number, n: number, from: number, to: number) => {
      for (let i = 0; i < n; i++) {
        const at = total * (from + ((to - from) * (i + rand.range(0.2, 0.8))) / n);
        const { p, t } = pointAt(samples, at);
        const d = rootlet(p, t, rand.sign(), rand.range(14, 38), rand);
        rootlets.push({ path: this.path(d, 'roots__rootlet'), parent, at });
      }
    };
    addRootlets(tapS, tapLen, -1, 9, 0.08, 0.97);
    branches.forEach((b, i) => addRootlets(b.samples, b.total, i, 3, 0.25, 0.85));

    // glow overlays for the finale (same geometry, drawn on top)
    const glowG = this.group('roots__glows');
    const tapGlowSoft = this.path(tapD, 'roots__glow roots__glow--soft', glowG);
    const tapGlow = this.path(tapD, 'roots__glow', glowG);
    const branchGlows = branches.map((b) => [this.path(b.d, 'roots__glow roots__glow--soft', glowG), this.path(b.d, 'roots__glow', glowG)]);

    return { rand, W, H, Hw, O, J, net, ground, dots, tap, tapLen, tapS, sap, branches, deepTip, rootlets, glowG, tapGlow, tapGlowSoft, branchGlows };
  }

  /* ============================== story reveal (shared) ============================== */
  storyReveal(scrubWords: boolean) {
    const split = SplitText.create(this.title, { type: 'lines', mask: 'lines', linesClass: 'roots__line', aria: 'none' });
    gsap.set(split.lines, { yPercent: 105 });
    gsap.set(this.eyebrow, { opacity: 0, y: 14 });
    gsap.set(this.frame, { clipPath: 'inset(100% 0% 0% 0%)' });
    if (this.img) gsap.set(this.img, { scale: 1.2, transformOrigin: '50% 60%' });
    const artPaths = this.art && !this.frame.classList.contains('roots__frame--real') ? this.art.querySelectorAll('path') : null;
    if (artPaths) gsap.set(artPaths, { drawSVG: '0%' });

    const tl = gsap.timeline({ paused: true })
      .to(this.frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.out' }, 0)
      .to(this.eyebrow, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 0.15)
      .to(split.lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 0.25);
    if (this.img) tl.to(this.img, { scale: 1, duration: 1.4, ease: 'power4.out' }, 0);
    if (artPaths) tl.to(artPaths, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut', stagger: 0.08 }, 0.5);
    this.prime(tl);
    ScrollTrigger.create({ trigger: this.s, start: 'top 72%', once: true, onEnter: () => tl.play() });

    const words = SplitText.create(this.text, { type: 'words', wordsClass: 'roots__word', aria: 'none' }).words;
    gsap.set(words, { opacity: 0.22 });
    if (!scrubWords) {
      const read = this.prime(gsap.to(words, { opacity: 1, ease: 'none', stagger: 0.1, paused: true }));
      ScrollTrigger.create({ trigger: this.text, start: 'top 82%', end: 'bottom 52%', scrub: true, animation: read });
    }
    return { words };
  }

  /* ============================== modes ============================== */
  setupPinned() {
    const g = this.buildDesktop();
    const { H, J, net, tap, tapLen, tapS, branches } = g;
    const camNet = net.y + net.h - H;
    const tipEnd = lengthAtY(tapS, net.y + H * 0.5);
    const lenTease = lengthAtY(tapS, H * 0.93);
    const lenTop = lengthAtY(tapS, camNet - H * 0.08);
    const { words } = this.storyReveal(true);

    // initial states
    const tips = branches.map((b) => b.tip).filter((t): t is SVGPathElement => !!t);
    gsap.set([tap, ...g.sap, ...branches.map((b) => b.path), ...tips, g.deepTip, ...g.rootlets.map((r) => r.path)], { drawSVG: '0 0' });
    gsap.set([g.tapGlow, g.tapGlowSoft], { drawSVG: `${tapLen} ${tapLen}` });
    gsap.set(g.branchGlows.flat(), { drawSVG: '100% 100%' });
    const nodeParts = this.nodes.map((n) => ({
      n,
      ring: n.querySelector<SVGPathElement>('.roots__ring path')!,
      icon: n.querySelectorAll<SVGElement>('.roots__icon > *'),
      title: n.querySelector<HTMLElement>('.roots__node-title')!,
      text: n.querySelector<HTMLElement>('.roots__node-text')!,
    }));
    nodeParts.forEach(({ ring, icon, title, text, n }) => {
      gsap.set(ring, { drawSVG: '0%' });
      gsap.set(ring.ownerSVGElement, { autoAlpha: 0 });
      gsap.set(icon, { drawSVG: '0%' });
      gsap.set([title, text], { opacity: 0, y: 18 });
      gsap.set(n, { '--lit': 0, '--glow': 0 });
    });
    const netSplit = SplitText.create(this.netTitle, { type: 'lines', mask: 'lines', aria: 'none' });
    gsap.set(netSplit.lines, { yPercent: 105 });

    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    // 1 · the story: words read in, the sapling's roots start
    tl.to(words, { opacity: 1, duration: 0.3, stagger: 0.9 / Math.max(1, words.length) }, 0.05);
    if (this.img) tl.fromTo(this.img, { yPercent: -3 }, { yPercent: 3, duration: TL.descentAt + TL.descentDur }, 0);
    tl.to(tap, { drawSVG: `0 ${lenTease}`, duration: TL.descentAt }, 0);
    tl.to(g.sap, { drawSVG: '0 100%', duration: 1, stagger: 0.25, ease: 'power1.out' }, 0.15);
    // 2 · descent: the camera goes under the ground, the tap root leads
    tl.to(this.world, { y: -camNet, duration: TL.descentDur, ease: 'power2.inOut' }, TL.descentAt);
    tl.to(tap, { drawSVG: `0 ${tipEnd}`, duration: TL.descentDur, ease: 'power1.inOut' }, TL.descentAt);
    tl.to(this.copy, { y: -H * 0.08, duration: TL.descentDur, ease: 'power1.in' }, TL.descentAt);
    tl.to(netSplit.lines, { yPercent: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, TL.descentAt + TL.descentDur * 0.55);
    // 3 · the five directions
    tl.to(tap, { drawSVG: `0 ${tapLen}`, duration: TL.tapNetDur }, TL.netAt);
    const tapTimeAt = (l: number) => (l <= lenTease ? (l / Math.max(1, lenTease)) * TL.descentAt
      : l <= tipEnd ? TL.descentAt + ((l - lenTease) / Math.max(1, tipEnd - lenTease)) * TL.descentDur
        : TL.netAt + ((l - tipEnd) / Math.max(1, tapLen - tipEnd)) * TL.tapNetDur);
    // The root reaching a node is scrubbed; the node itself lights with a short TIME-based draw (ring, icon,
    // title, caption) once the root gets there — so a node is never left half-drawn when scrolling stops.
    // Scrolling back above the ignition point plays it backwards (faster).
    const ignite: number[] = [];
    const nodeTls = nodeParts.map(({ n, ring, icon, title, text }) => gsap.timeline({ paused: true })
      .set(ring.ownerSVGElement, { autoAlpha: 0.9, immediateRender: false }, 0.001)
      .to(ring, { drawSVG: '100%', duration: 0.7, ease: 'power2.out' }, 0)
      .to(n, { '--lit': 1, duration: 0.8, ease: 'power2.out' }, 0)
      .to(icon, { drawSVG: '100%', duration: 0.9, stagger: 0.08, ease: 'power2.inOut' }, 0.12)
      .to(title, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.2)
      .to(text, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.32));
    nodeTls.forEach((t) => this.prime(t));
    const nodeOn = nodeParts.map(() => false);
    const lightNode = (i: number, at: number) => { ignite[i] = at; };
    branches.forEach((b, i) => {
      const start = Math.max(TL.netAt + i * TL.branchEvery, tapTimeAt(b.lenB) + 0.05);
      tl.to(b.path, { drawSVG: '0 100%', duration: TL.branchDur, ease: 'power1.inOut' }, start);
      lightNode(i, start + TL.branchDur - 0.05);
      if (b.tip) tl.to(b.tip, { drawSVG: '0 100%', duration: 0.7, ease: 'power1.out' }, start + TL.branchDur + 0.1);
    });
    const deepAt = TL.netAt + TL.tapNetDur;
    lightNode(4, deepAt);
    tl.to(g.deepTip, { drawSVG: '0 100%', duration: 0.7, ease: 'power1.out' }, deepAt + 0.1);
    g.rootlets.forEach((r) => {
      const at = r.parent < 0 ? tapTimeAt(r.at) : Math.max(TL.netAt + r.parent * TL.branchEvery, tapTimeAt(branches[r.parent].lenB) + 0.05) + (r.at / branches[r.parent].total) * TL.branchDur;
      tl.to(r.path, { drawSVG: '0 100%', duration: 0.45, ease: 'power1.out' }, at);
    });
    // 4 · finale: light gathers from the five nodes into the tap root and rises out of the ground —
    //     then the branches dim and ONE bright line carries on up, the camera following it a little:
    //     "the roots converge into one line that leads upward" (brief, section 5 · 3)
    const glowAt = (l: number) => TL.glowAt + ((tapLen - l) / Math.max(1, tapLen - lenTop)) * TL.glowDur;
    tl.to([g.tapGlow, g.tapGlowSoft], { drawSVG: `${lenTop} ${tapLen}`, duration: TL.glowDur, ease: 'none' }, TL.glowAt);
    tl.to(nodeParts[4].n, { '--glow': 1, duration: 0.4, ease: 'power2.out' }, TL.glowAt - 0.2);
    branches.forEach((b, i) => {
      const arrive = glowAt(b.lenB);
      tl.to(g.branchGlows[i], { drawSVG: '0% 100%', duration: TL.branchGlowDur, ease: 'power1.in' }, arrive - TL.branchGlowDur);
      tl.to(nodeParts[i].n, { '--glow': 1, duration: 0.4, ease: 'power2.out' }, arrive - TL.branchGlowDur - 0.15);
    });
    // The pan may never push a node out of the stage: the pin ends on this frame and the next section follows the
    // stage's bottom edge, so a node cut by the viewport here stays cut while the whole block scrolls away (the
    // lowest captions sliced by the seasons panel on desktop). Up to a quarter screen, but the lowest caption keeps
    // at least ~8vh of soil below it.
    const lowest = Math.max(...this.nodes.map((n) => this.box(n, this.world.getBoundingClientRect()).bottom));
    const room = H - Math.max(56, H * 0.08) - (lowest - camNet);
    const panUp = Math.round(Math.max(0, Math.min(H * 0.24, room)));
    const lenOut = lengthAtY(tapS, camNet - panUp - H * 0.1);
    tl.to(g.branchGlows.flat(), { opacity: 0.16, duration: 0.7, ease: 'power1.inOut' }, TL.riseAt);
    tl.to(nodeParts.map((p) => p.n), { '--glow': 0.3, duration: 0.7, ease: 'power1.inOut' }, TL.riseAt);
    tl.to([g.tapGlow, g.tapGlowSoft], { drawSVG: `${lenOut} ${tapLen}`, duration: TL.riseDur, ease: 'power1.in' }, TL.riseAt);
    tl.to(this.world, { y: -(camNet - panUp), duration: TL.riseDur + 0.2, ease: 'power2.inOut' }, TL.riseAt);
    tl.to({}, { duration: Math.max(0, TL.end - tl.duration()) });

    // pin: ~320vh in total; #directions lands where all five nodes are lit
    const dist = () => Math.round(window.innerHeight * PIN_VH);
    const placeAnchor = () => { this.anchor.style.top = `${Math.round((TL.allLit / tl.duration()) * dist())}px`; };
    // The pinned net never sits at its own document position, so links to #directions resolve to a marker
    // placed at that scroll offset. The marker precedes the net in the DOM (getElementById finds it first);
    // the net keeps its id so observers that grabbed it earlier (header "you are here") still work.
    this.anchor.id = 'directions';
    this.anchor.removeAttribute('aria-hidden');
    this.netTitle.setAttribute('tabindex', '-1');
    const toHeading = () => this.netTitle.focus({ preventScroll: true });
    this.anchor.addEventListener('focus', toHeading);
    this.disposers.push(() => {
      this.anchor.removeEventListener('focus', toHeading);
      this.anchor.setAttribute('aria-hidden', 'true');
      this.netTitle.removeAttribute('tabindex');
    });
    placeAnchor();
    this.tlDur = tl.duration();
    this.prime(tl);
    this.pin = ScrollTrigger.create({
      trigger: this.s,
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: this.stage,
      scrub: 0.6,
      anticipatePin: 1,
      animation: tl,
      invalidateOnRefresh: true,
      onRefresh: () => {
        placeAnchor();
        // a refresh reverts + invalidates the timeline: initialise the tweens beyond the playhead again, here
        const p = tl.progress();
        tl.progress(1, true).progress(p, true);
      },
    });

    // dog: appears with its node, follows the cursor along the bottom of the section
    this.dog = mountDog(this.net, { mode: 'follow', home: nodeParts[1].n.querySelector<HTMLElement>('.roots__dot')!, hidden: true });
    let dogShown = false;
    tl.eventCallback('onUpdate', () => {
      const t = tl.time();
      nodeTls.forEach((ntl, i) => {
        const on = t >= ignite[i] - 0.08;
        if (on === nodeOn[i]) return;
        nodeOn[i] = on;
        if (on) { ntl.timeScale(1).play(); sound.play('pop', { volume: 0.25 }); } else ntl.timeScale(1.8).reverse();
      });
      const show = t >= ignite[1] + 0.5;
      if (show !== dogShown) { dogShown = show; show ? this.dog?.show() : this.dog?.hide(); }
    });

    this.makeFlies(g.rand, 9, { x0: g.W * 0.04, x1: g.W * 0.96, y0: g.ground.y + H * 0.3, y1: g.Hw - 40 });
  }

  setupStatic() {
    const mobile = this.mode === 'mobile-static';
    if (mobile) this.buildMobile(); else this.buildDesktop();
    this.nodes.forEach((n) => n.style.setProperty('--lit', '1'));
    // reduced motion: simple fades only
    const blocks = [this.frame, this.copy, this.netTitle, ...this.nodes];
    blocks.forEach((el) => gsap.from(el, {
      opacity: 0, duration: 0.6, ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    }));
  }

  /* -------- phone: one vertical root through the section -------- */
  buildMobile() {
    const rand = seeded(612);
    this.drawSurface(rand);
    const { W, Hw, wr } = this.sizeLines();
    const frame = this.box(this.frame, wr);
    const copy = this.box(this.copy, wr);
    const ground = this.box(this.ground, wr);
    const dots = this.nodes.map((n) => this.box(n.querySelector('.roots__dot')!, wr));
    const colX = dots[0].cx;
    this.drawSoil(rand, W, Hw, ground.y, [copy, frame, this.box(this.netTitle, wr), ...this.nodes.map((n) => this.box(n, wr))], 14);

    const O: P = { x: frame.cx + 2, y: frame.bottom - 10 };
    const reach = Math.max(O.y + 104, copy.y + 96);
    const pts: P[] = [
      O,
      { x: O.x + 3, y: O.y + 34 },
      { x: O.x + (colX - O.x) * 0.56, y: O.y + (reach - O.y) * 0.66 },
      { x: colX - 3, y: reach },
    ];
    // down beside the story, then through every node
    let y = reach;
    for (const d of dots) {
      while (d.cy - y > 170) { y += 150; pts.push({ x: colX + rand.range(-5, 5), y }); }
      pts.push({ x: colX, y: d.cy });
      y = d.cy;
    }
    pts.push({ x: colX + 4, y: y + 90 }, { x: colX - 3, y: Hw - 50 }, { x: colX, y: Hw + 4 });
    const line = this.path(smoothPath(pts), 'roots__root roots__root--tap');
    const { total, samples } = samplePath(line, 6);
    const rootlets: { path: SVGPathElement; at: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const at = total * (0.06 + (0.9 * (i + rand.range(0.2, 0.8))) / 12);
      const { p, t } = pointAt(samples, at);
      if (dots.some((d) => Math.abs(d.cy - p.y) < 40)) continue;
      rootlets.push({ path: this.path(rootlet(p, t, rand.sign(), rand.range(12, 28), rand), 'roots__rootlet'), at });
    }
    const sap = this.path(smoothPath([O, { x: O.x - 18, y: O.y + 26 }, { x: O.x - 38, y: O.y + 50 }, { x: O.x - 46, y: O.y + 84 }]), 'roots__root roots__root--thin');
    return { rand, W, Hw, ground, dots, line, total, samples, rootlets, sap };
  }

  setupMobile() {
    const g = this.buildMobile();
    const { line, samples } = g;
    this.storyReveal(false);
    const netSplit = SplitText.create(this.netTitle, { type: 'lines', mask: 'lines', aria: 'none' });
    gsap.set(netSplit.lines, { yPercent: 105 });
    const netIn = this.prime(gsap.to(netSplit.lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, paused: true }));
    ScrollTrigger.create({ trigger: this.netTitle, start: 'top 82%', once: true, onEnter: () => netIn.play() });

    // The root grows by a moving clip (roots.css .roots__grow): a composited wrapper slides down with the tip while
    // the drawing inside slides back up by the same amount. The line stays put on the page; per scroll frame only
    // two transforms change — no stroke-dash repaint of a section-tall SVG (and of the soil under it) every frame.
    // The line only descends, so "everything above the tip" is exactly "drawn up to the tip".
    // the layer covers only the line's own box (+ stroke and cap), in world coordinates
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of samples) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    x0 = Math.floor(x0 - 4); y0 = Math.floor(y0 - 4); x1 = Math.ceil(x1 + 4); y1 = Math.ceil(y1 + 4);
    const w = x1 - x0, H = y1 - y0;
    const grow = document.createElement('div');
    grow.className = 'roots__grow';
    grow.setAttribute('aria-hidden', 'true');
    grow.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${H}px`;
    const art = document.createElementNS(NS, 'svg');
    art.setAttribute('class', 'roots__grow-art');
    art.setAttribute('focusable', 'false');
    art.setAttribute('viewBox', `${x0} ${y0} ${w} ${H}`);
    art.setAttribute('width', String(w));
    art.setAttribute('height', String(H));
    art.append(line);
    grow.append(art);
    this.lines.after(grow); // above the soil details and rootlets, below the fireflies, story and nodes — as before
    this.disposers.push(() => grow.remove());
    let shown = NaN;
    const reveal = (tipY: number) => {
      const c = Math.round(Math.min(H, Math.max(0, tipY - y0)));
      if (c === shown) return;
      shown = c;
      grow.style.transform = `translate3d(0, ${c - H}px, 0)`;
      art.style.transform = `translate3d(0, ${H - c}px, 0)`;
    };

    gsap.set(g.rootlets.map((r) => r.path), { drawSVG: '0%' });
    gsap.set(g.sap, { drawSVG: '0%' });

    const parts = this.nodes.map((n, i) => {
      const ring = n.querySelector<SVGPathElement>('.roots__ring path')!;
      const icon = n.querySelectorAll<SVGElement>('.roots__icon > *');
      const title = n.querySelector<HTMLElement>('.roots__node-title')!;
      const text = n.querySelector<HTMLElement>('.roots__node-text')!;
      gsap.set(ring, { drawSVG: '0%' });
      gsap.set(ring.ownerSVGElement, { autoAlpha: 0 });
      gsap.set(icon, { drawSVG: '0%' });
      gsap.set([title, text], { opacity: 0.36 }); // dim, not gone: the 26px title stays ≥ 3:1 on soil
      gsap.set(n, { '--lit': 0 });
      const tl = this.prime(gsap.timeline({ paused: true })
        .set(ring.ownerSVGElement, { autoAlpha: 0.9, immediateRender: false }, 0.001)
        .to(ring, { drawSVG: '100%', duration: 0.6, ease: 'power2.out' }, 0)
        .to(n, { '--lit': 1, duration: 0.8, ease: 'power2.out' }, 0)
        .to(icon, { drawSVG: '100%', duration: 0.8, stagger: 0.06, ease: 'power2.inOut' }, 0.1)
        .to([title, text], { opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out' }, 0.15));
      return { y: g.dots[i].cy, tl, lit: false };
    });
    const rl = g.rootlets.map((r) => ({ ...r, on: false, tw: this.prime(gsap.to(r.path, { drawSVG: '100%', duration: 0.6, ease: 'power1.out', paused: true })) }));
    const sapTw = this.prime(gsap.to(g.sap, { drawSVG: '100%', duration: 1.2, ease: 'power1.out', paused: true }));
    let sapOn = false;

    // Geometry is measured at refresh, never in a scroll frame: the world's page offset (layout) and the viewport
    // height (resize — the iOS address bar) are cached; the scroll position comes from ScrollTrigger's own cache.
    let worldTop = 0;
    let vh = window.innerHeight;
    const measure = () => { worldTop = this.world.getBoundingClientRect().top + window.scrollY; vh = window.innerHeight; };
    const onResize = () => { vh = window.innerHeight; };
    window.addEventListener('resize', onResize, { passive: true });
    this.disposers.push(() => window.removeEventListener('resize', onResize));

    const update = (scroll: number) => {
      const tipY = vh * 0.76 - (worldTop - scroll); // the tip runs a little ahead of the reading line
      reveal(tipY);
      const len = lengthAtY(samples, tipY);
      parts.forEach((p) => {
        const on = tipY >= p.y - 2;
        if (on !== p.lit) {
          p.lit = on;
          if (on) { p.tl.timeScale(1).play(); sound.play('pop', { volume: 0.2 }); } else p.tl.timeScale(2).reverse();
        }
      });
      rl.forEach((r) => {
        const on = len >= r.at;
        if (on !== r.on) { r.on = on; on ? r.tw.play() : r.tw.reverse(); }
      });
      const s = len > 4;
      if (s !== sapOn) { sapOn = s; s ? sapTw.play() : sapTw.reverse(); }
    };
    measure();
    ScrollTrigger.create({
      trigger: this.world, start: 'top bottom', end: 'bottom top',
      onUpdate: (st) => update(st.scroll()),
      onRefresh: (st) => { measure(); update(st.scroll()); },
    });
    update(window.scrollY);
    this.makeFlies(g.rand, 5, { x0: g.W * 0.08, x1: g.W * 0.92, y0: g.ground.y + 260, y1: g.Hw - 60 });
  }
}

export function initRoots(): void {
  const section = document.querySelector<HTMLElement>('section.roots');
  if (!section) return;
  syncCopy(section);
  const roots = new Roots(section);
  roots.mount();
  renderGrain(section).then((url) => {
    if (!url) return;
    section.style.setProperty('--roots-grain', `url("${url}")`);
    section.classList.add('roots--grain');
  });

  let timer = 0;
  let place: Place | null = null;
  const schedule = (delay = 220) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { const p = place; place = null; roots.rebuild(p); }, delay);
  };
  // record the reading position now, before this or any other section changes its layout
  bus.on('motion:change', () => {
    place ??= roots.capturePlace();
    if (import.meta.env.DEV) (window as any).__ofRootsPlace = place && { ...place, el: 'el' in place ? `${place.el.tagName}.${place.el.className}` : null };
    schedule(0);
  });
  window.matchMedia(COMPACT_MQ).addEventListener?.('change', () => schedule(0));
  let lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    // phones: ignore height-only changes (address bar); desktop: the pinned stage is vh-based
    const changed = Math.abs(w - lastW) > 2 || (!env.isTouch && Math.abs(h - lastH) > 40);
    if (!changed) return;
    lastW = w; lastH = h;
    schedule();
  });
  // webfonts change line heights / label sizes → re-measure once they settle (phones: not under the finger — a
  // rebuild ends in a full ScrollTrigger.refresh)
  const sig = roots.signature();
  document.fonts?.ready.then(() => {
    if (roots.signature() === sig) return;
    if (env.isTouch) whenScrollQuiet(() => schedule(0)); else schedule(60);
  });
}
