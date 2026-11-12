/* ==========================================================================
   Home 3 — "מתחת לפני השטח" (under the ground). Markup: partials/home/roots.html
   ONE motion idea: the root grows with your scroll.
   • Desktop + motion ('pinned'): a pinned stage (~320vh of scroll). The camera
     descends through a cross-section — cream surface → soil — while a root
     grows from the sapling in the photo (DrawSVG, scrubbed), branches to the
     five directions, each node lighting up (ring + icon draw themselves, title
     and caption rise). At the end the light gathers from the five nodes into
     the tap root and rises up and out — the roots converge into one line that
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
import {
  seeded, smoothPath, pebble, samplePath, lengthAtY, pointAt, rootlet, surfaceMarkup,
  type P, type Rand, type Sample,
} from './roots-geometry';

const NS = 'http://www.w3.org/2000/svg';
type Mode = 'pinned' | 'static' | 'mobile' | 'mobile-static';
interface Box { x: number; y: number; w: number; h: number; cx: number; cy: number; bottom: number }

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
  glowAt: 9.0, glowDur: 1.3, branchGlowDur: 0.6,
  end: 10.9,
  allLit: 8.95,            // where #directions lands (just before the finale)
};
const PIN_VH = 2.5;        // pinned scroll distance in viewport heights (section ≈ 350vh)

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
    const mobile = env.isMobile();
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
  }

  teardown() {
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
  }

  /** layout fingerprint (transform-independent) — rebuild only when it really changed */
  signature(): string {
    return [this.copy, this.title, this.netTitle, this.frame, ...this.nodes].map((el) => `${el.offsetTop}:${el.offsetHeight}:${el.offsetWidth}`).join('|');
  }

  rebuild() {
    this.teardown();
    this.mount();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
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
    this.surface.innerHTML = surfaceMarkup(w, h, rand, env.isMobile() ? { amp: 5, tufts: 70 } : { amp: 7, tufts: 120 });
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

  /** Rare fireflies: soft breathing glows that drift a little. Paused off-screen. */
  makeFlies(rand: Rand, count: number, zone: { x0: number; x1: number; y0: number; y1: number }) {
    const tweens: gsap.core.Animation[] = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'roots__fly';
      this.flies.append(el);
      gsap.set(el, { x: rand.range(zone.x0, zone.x1), y: rand.range(zone.y0, zone.y1), opacity: 0 });
      const peak = rand.range(0.5, 0.95);
      tweens.push(gsap.timeline({ repeat: -1, repeatDelay: rand.range(3, 9), delay: rand.range(0, 8), paused: true })
        .to(el, { opacity: peak, duration: rand.range(1.2, 1.8), ease: 'sine.inOut' })
        .to(el, { opacity: peak * 0.55, duration: 0.7, ease: 'sine.inOut' })
        .to(el, { opacity: peak, duration: 0.6, ease: 'sine.inOut' })
        .to(el, { opacity: 0, duration: rand.range(1.6, 2.4), ease: 'sine.inOut' }));
      tweens.push(gsap.to(el, {
        x: `+=${rand.range(-36, 36)}`, y: `+=${rand.range(-28, 18)}`,
        duration: rand.range(6, 10), ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true,
      }));
    }
    ScrollTrigger.create({
      trigger: this.s, start: 'top bottom', end: 'bottom top',
      onToggle: (st) => tweens.forEach((t) => (st.isActive ? t.play() : t.pause())),
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
      const tip = i === 1 ? null : this.path(this.tipPath(this.nodes[i], N, side), 'roots__root roots__root--thin');
      return { path, d, total, samples, lenB, B, side, tip };
    });
    const deepTip = this.path(this.tipPath(this.nodes[4], deep, -1), 'roots__root roots__root--thin');

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
    const split = SplitText.create(this.title, { type: 'lines', mask: 'lines', linesClass: 'roots__line' });
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
    ScrollTrigger.create({ trigger: this.s, start: 'top 72%', once: true, onEnter: () => tl.play() });

    const words = SplitText.create(this.text, { type: 'words', wordsClass: 'roots__word' }).words;
    gsap.set(words, { opacity: 0.22 });
    if (!scrubWords) {
      gsap.to(words, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: this.text, start: 'top 82%', end: 'bottom 52%', scrub: true },
      });
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
    const netSplit = SplitText.create(this.netTitle, { type: 'lines', mask: 'lines' });
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
    // 4 · finale: light gathers from the five nodes into the tap root and rises out of the ground
    const glowAt = (l: number) => TL.glowAt + ((tapLen - l) / Math.max(1, tapLen - lenTop)) * TL.glowDur;
    tl.to([g.tapGlow, g.tapGlowSoft], { drawSVG: `${lenTop} ${tapLen}`, duration: TL.glowDur, ease: 'none' }, TL.glowAt);
    tl.to(nodeParts[4].n, { '--glow': 1, duration: 0.4, ease: 'power2.out' }, TL.glowAt - 0.2);
    branches.forEach((b, i) => {
      const arrive = glowAt(b.lenB);
      tl.to(g.branchGlows[i], { drawSVG: '0% 100%', duration: TL.branchGlowDur, ease: 'power1.in' }, arrive - TL.branchGlowDur);
      tl.to(nodeParts[i].n, { '--glow': 1, duration: 0.4, ease: 'power2.out' }, arrive - TL.branchGlowDur - 0.15);
    });
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
    ScrollTrigger.create({
      trigger: this.s,
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: this.stage,
      scrub: 0.6,
      anticipatePin: 1,
      animation: tl,
      invalidateOnRefresh: true,
      onRefresh: placeAnchor,
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
    const { line, total, samples } = g;
    this.storyReveal(false);
    const netSplit = SplitText.create(this.netTitle, { type: 'lines', mask: 'lines' });
    gsap.set(netSplit.lines, { yPercent: 105 });
    gsap.to(netSplit.lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: this.netTitle, start: 'top 82%', once: true } });

    line.style.strokeDasharray = `${total} ${total}`;
    line.style.strokeDashoffset = String(total);
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
      gsap.set([title, text], { opacity: 0.2 });
      gsap.set(n, { '--lit': 0 });
      const tl = gsap.timeline({ paused: true })
        .set(ring.ownerSVGElement, { autoAlpha: 0.9, immediateRender: false }, 0.001)
        .to(ring, { drawSVG: '100%', duration: 0.6, ease: 'power2.out' }, 0)
        .to(n, { '--lit': 1, duration: 0.8, ease: 'power2.out' }, 0)
        .to(icon, { drawSVG: '100%', duration: 0.8, stagger: 0.06, ease: 'power2.inOut' }, 0.1)
        .to([title, text], { opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out' }, 0.15);
      return { y: g.dots[i].cy, tl, lit: false };
    });
    const rl = g.rootlets.map((r) => ({ ...r, on: false, tw: gsap.to(r.path, { drawSVG: '100%', duration: 0.6, ease: 'power1.out', paused: true }) }));
    const sapTw = gsap.to(g.sap, { drawSVG: '100%', duration: 1.2, ease: 'power1.out', paused: true });
    let sapOn = false;

    const update = () => {
      const top = this.world.getBoundingClientRect().top;
      const tipY = window.innerHeight * 0.66 - top;
      const len = lengthAtY(samples, tipY);
      line.style.strokeDashoffset = String(Math.max(0, total - len));
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
    ScrollTrigger.create({ trigger: this.world, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update });
    update();
    this.makeFlies(g.rand, 5, { x0: g.W * 0.08, x1: g.W * 0.92, y0: g.ground.y + 260, y1: g.Hw - 60 });
  }
}

export function initRoots(): void {
  const section = document.querySelector<HTMLElement>('section.roots');
  if (!section) return;
  syncCopy(section);
  const roots = new Roots(section);
  roots.mount();

  let timer = 0;
  const schedule = (delay = 220) => { window.clearTimeout(timer); timer = window.setTimeout(() => roots.rebuild(), delay); };
  bus.on('motion:change', () => schedule(0));
  window.matchMedia('(max-width: 768px)').addEventListener?.('change', () => schedule(0));
  let lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    // phones: ignore height-only changes (address bar); desktop: the pinned stage is vh-based
    const changed = Math.abs(w - lastW) > 2 || (!env.isTouch && Math.abs(h - lastH) > 40);
    if (!changed) return;
    lastW = w; lastH = h;
    schedule();
  });
  // webfonts change line heights / label sizes → re-measure once they settle
  const sig = roots.signature();
  document.fonts?.ready.then(() => { if (roots.signature() !== sig) schedule(60); });
}
