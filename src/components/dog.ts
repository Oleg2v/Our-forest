/* ==========================================================================
   The line-art dog — CONTRACT (owned by the home "roots" agent).
   A small Canaan-type dog drawn in the forest's line-icon style
   (round caps/joins, 1.5px stroke, no fill, currentColor).

   mountDog(host, { mode: 'follow' })
     Lives in the "עבודה עם כלבים" node: draws itself (show()), sits next to
     `home`, then trots down to the bottom of `host` and runs after the cursor.
     A click inside the host makes it sit and wag its tail.
   mountDog(host, { mode: 'runAcross' })
     Runs across the bottom of `host` once (RTL: right → left), stops halfway
     to sit and wag, then runs off. Autoplays once when the host is in view
     (autoplay:false to trigger it yourself with handle.runAcross()).

   No dog on phones / touch devices / reduced motion → a no-op handle.
   Poses: run cycle = procedural part rotations (legs, head, tail, body bob);
   stand ↔ sit = MorphSVG between two drawings of the same parts.
   ========================================================================== */
import './dog.css';
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';

export interface DogOptions {
  mode: 'follow' | 'runAcross';
  /** follow: element the dog first sits next to (its outer, inline-end side) */
  home?: HTMLElement;
  /** follow: start hidden and wait for show() (default false) */
  hidden?: boolean;
  /** runAcross: run once automatically when the host scrolls into view (default true) */
  autoplay?: boolean;
  /** px between the host's bottom edge and the paws (default 14). A function is read every frame: a host that is
      partly below the visible frame (the roots' pinned net while the camera pans up) keeps the dog in view. */
  ground?: number | (() => number);
}
export interface DogHandle {
  destroy(): void;
  runAcross(): Promise<void>;
  /** follow: draw the dog in (sitting at home) */
  show(): void;
  /** follow: fade the dog out (e.g. when its node un-lights on scroll back) */
  hide(): void;
  /** sit down and wag */
  sit(): void;
}

const noop = (): DogHandle => ({ destroy() {}, async runAcross() {}, show() {}, hide() {}, sit() {} });

/* ---- artwork: same parts in two poses (viewBox -2 -6 72 58, ground y = 49.5, facing left) ---- */
type Part = 'head' | 'ear' | 'back' | 'chest' | 'belly' | 'rump' | 'tail' | 'fn' | 'ff' | 'bn' | 'bf';
const STAND: Record<Part, string> = {
  head: 'M22 15C21 13 20.5 11.5 20 10L17.6 3.6L14.4 9.8C12.8 10.2 11.4 11 10.2 12.4C8.4 13.3 6.2 14 4.4 14.8C3.4 15.3 3.4 16.7 4.6 17C6.8 17.6 9.4 18 11 18.6C12.4 19.1 13.6 19.9 14.6 21',
  ear: 'M17.3 6.6L16.3 9.4',
  back: 'M22 15C24 18 27 19.5 32 19.6L44 19.4C48 19.3 51 19.6 53 20.6',
  chest: 'M14.6 21C16.4 23.4 18 26 19.6 28.6',
  belly: 'M19.6 28.6C24 30.6 30 31.2 36 30.8C40.5 30.4 44 29.2 47 28.4',
  rump: 'M53 20.6C55.2 22 56 25 55 28',
  tail: 'M53 20.4C56 18.8 58.6 16 58.4 12.6C58.2 10 55.6 9.4 54.2 11C53 12.4 54 14.4 56 14.2',
  fn: 'M20.5 27C21 32 21.2 38 20.8 44L20.6 47.6C20.5 48.8 19.6 49.4 17.8 49.4',
  ff: 'M24 28C24.4 33 24.6 38 24.3 44L24.1 47.6C24 48.8 23.1 49.4 21.3 49.4',
  bn: 'M50 25C52.6 28.6 53.8 32.4 52 36.6C51 38.8 49.6 40.6 49.4 43.6L49.2 47.6C49.1 48.8 48.2 49.4 46.4 49.4',
  bf: 'M46.5 26C49 29.4 50 33 48.4 37C47.4 39.2 46 41 45.8 44L45.6 47.6C45.5 48.8 44.6 49.4 42.8 49.4',
};
const SIT: Record<Part, string> = {
  head: 'M25 9C24 7 23.5 5.5 23 4L20.6 -2.4L17.4 3.8C15.8 4.2 14.4 5 13.2 6.4C11.4 7.3 9.2 8 7.4 8.8C6.4 9.3 6.4 10.7 7.6 11C9.8 11.6 12.4 12 14 12.6C15.4 13.1 16.6 13.9 17.6 15',
  ear: 'M20.3 0.6L19.3 3.4',
  back: 'M25 9C27.6 12.4 30.8 16.6 34 21.2C38 27 42.2 33 46.4 38.4C48.8 41.4 51 43.6 53 45',
  chest: 'M17.6 15C19.2 18 20.4 21 21.4 24.4',
  belly: 'M25.4 30.6C29 31.4 32.6 32.6 36.4 35.2',
  rump: 'M53 45C54.6 46.6 54.6 48.6 52.6 49.6',
  tail: 'M52.6 49.4C56.6 49.6 60.4 49 62.8 46.8C64.4 45.2 63.6 43.2 61.8 43.8',
  fn: 'M21.4 24.4C21.8 31 22 38 21.6 44L21.4 47.6C21.3 48.8 20.4 49.4 18.6 49.4',
  ff: 'M25 25C25.4 31.6 25.6 38 25.2 44L25 47.6C24.9 48.8 24 49.4 22.2 49.4',
  bn: 'M44.2 34.2C39.6 34.6 36.4 38.4 36.6 42.8C36.8 46.4 39.2 48.8 42 49.4L34.6 49.5',
  bf: 'M33.4 49.5L30.8 49.5',
};
const EYE = { stand: [11.8, 13.4], sit: [14.8, 7.4] } as const;
const NOSE = { stand: [4.2, 15.6], sit: [7.2, 9.6] } as const;
/** rotation pivots (viewBox units) */
type Pt = [number, number];
const PIVOT: Record<'fn' | 'ff' | 'bn' | 'bf' | 'head' | 'tailStand' | 'tailSit', Pt> = {
  fn: [20.5, 27], ff: [24, 28], bn: [50, 25], bf: [46.5, 26], head: [21, 18], tailStand: [53, 20.4], tailSit: [52.6, 49.4],
};
const PARTS = Object.keys(STAND) as Part[];
const FAR: Part[] = ['ff', 'bf'];
const W = 72; const H = 58;
const MAX_V = 430; // px/s

function svgMarkup(): string {
  const path = (k: Part) => `<path data-part="${k}" d="${STAND[k]}"/>`;
  const leg = (k: Part) => `<g data-rot="${k}">${path(k)}</g>`;
  return `<svg class="dog__svg" viewBox="-2 -6 ${W} ${H}" focusable="false">
    <g class="dog__body">
      <g class="dog__far">${leg('ff')}${leg('bf')}</g>
      ${path('back')}${path('chest')}${path('belly')}${path('rump')}
      <g data-rot="tail">${path('tail')}</g>
      <g data-rot="head">${path('head')}${path('ear')}<circle class="dog__dot" data-dot="eye" cx="${EYE.stand[0]}" cy="${EYE.stand[1]}" r=".8"/><circle class="dog__dot" data-dot="nose" cx="${NOSE.stand[0]}" cy="${NOSE.stand[1]}" r="1"/></g>
      ${leg('fn')}${leg('bn')}
    </g>
  </svg>`;
}

const INTERACTIVE = 'a, button, input, textarea, select, label, [role="button"], [contenteditable]';

class Dog {
  layer: HTMLDivElement;
  el: HTMLDivElement;
  flip: HTMLDivElement;
  svg: SVGSVGElement;
  body: SVGGElement;
  paths = {} as Record<Part, SVGPathElement>;
  rot = {} as Record<'fn' | 'ff' | 'bn' | 'bf' | 'head' | 'tail', SVGGElement>;
  dots: { eye: SVGCircleElement; nose: SVGCircleElement };

  x = 0; y = 0; vel = 0; facing = 1; tilt = 0;
  phase = 0; wagPhase = 0; wagBoost = 0; speed = 0;
  pose: 'stand' | 'sit' = 'stand';
  state: 'hidden' | 'home' | 'toTrack' | 'follow' | 'sitting' | 'across' = 'hidden';
  visible = false; inView = false; ticking = false;
  pointerX: number | null = null; pointerMoved = false;
  sitTimer: gsap.core.Tween | null = null;
  moveTl: gsap.core.Timeline | null = null;
  acrossPromise: Promise<void> | null = null;
  io: IntersectionObserver;
  offMotion: () => void;
  destroyed = false;

  constructor(public host: HTMLElement, public opts: DogOptions) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.layer = document.createElement('div');
    this.layer.className = 'dog-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    this.el = document.createElement('div');
    this.el.className = 'dog';
    this.flip = document.createElement('div');
    this.flip.className = 'dog__flip';
    this.flip.innerHTML = svgMarkup();
    this.el.append(this.flip);
    this.layer.append(this.el);
    host.append(this.layer);
    this.svg = this.flip.querySelector('svg')!;
    this.body = this.svg.querySelector('.dog__body')!;
    PARTS.forEach((k) => (this.paths[k] = this.svg.querySelector(`[data-part="${k}"]`)!));
    (['fn', 'ff', 'bn', 'bf', 'head', 'tail'] as const).forEach((k) => (this.rot[k] = this.svg.querySelector(`[data-rot="${k}"]`)!));
    this.dots = { eye: this.svg.querySelector('[data-dot="eye"]')!, nose: this.svg.querySelector('[data-dot="nose"]')! };
    gsap.set(this.el, { autoAlpha: 0 });

    this.io = new IntersectionObserver((entries) => {
      this.inView = entries.some((e) => e.isIntersecting);
      this.syncTicker();
      if (this.inView && opts.mode === 'runAcross' && opts.autoplay !== false && !this.acrossPromise) this.runAcross();
    }, { threshold: opts.mode === 'runAcross' ? 0.35 : 0 });
    this.io.observe(host);

    if (opts.mode === 'follow') {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      host.addEventListener('click', this.onClick);
      if (!opts.hidden) this.show();
    }
    this.offMotion = bus.on('motion:change', ({ allowed }: { allowed: boolean }) => { if (!allowed) this.destroy(); });
  }

  /* ---------------- geometry ---------------- */
  hostSize() { return { w: this.host.clientWidth, h: this.host.clientHeight }; }
  trackY() {
    const g = this.opts.ground;
    return this.hostSize().h - (typeof g === 'function' ? g() : g ?? 14) - H + 6;
  }
  homePos() {
    const home = this.opts.home;
    const hr = this.host.getBoundingClientRect();
    if (!home) return { x: this.hostSize().w * 0.5 - W / 2, y: this.trackY() };
    const r = home.getBoundingClientRect();
    const rtl = getComputedStyle(this.host).direction === 'rtl';
    // sit on the outer (inline-end) side of the home element, paws on its bottom edge
    const x = rtl ? r.left - hr.left - W + 4 : r.right - hr.left - 4;
    return { x, y: r.bottom - hr.top - H + 6 };
  }
  place() {
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
  }
  face(dir: 1 | -1) {
    if (dir === this.facing) return;
    this.facing = dir;
    this.flip.style.transform = dir === 1 ? '' : 'scaleX(-1)';
  }

  /* ---------------- poses ---------------- */
  setPose(p: 'stand' | 'sit', dur = 0.36) {
    if (p === this.pose) return;
    this.pose = p;
    const src = p === 'sit' ? SIT : STAND;
    PARTS.forEach((k) => gsap.to(this.paths[k], { morphSVG: src[k], duration: dur, ease: 'power2.inOut', overwrite: true }));
    const e = p === 'sit' ? EYE.sit : EYE.stand; const n = p === 'sit' ? NOSE.sit : NOSE.stand;
    gsap.to(this.dots.eye, { attr: { cx: e[0], cy: e[1] }, duration: dur, ease: 'power2.inOut', overwrite: true });
    gsap.to(this.dots.nose, { attr: { cx: n[0], cy: n[1] }, duration: dur, ease: 'power2.inOut', overwrite: true });
  }

  /* ---------------- public ---------------- */
  show = () => {
    if (this.destroyed || this.visible) return;
    this.visible = true;
    this.moveTl?.kill();
    const home = this.homePos();
    this.x = home.x; this.y = home.y; this.vel = 0; this.tilt = 0;
    this.place();
    // look toward the node it sits next to
    this.face(this.opts.home && getComputedStyle(this.host).direction === 'rtl' ? -1 : 1);
    this.setPose('sit', 0);
    this.state = 'home';
    this.pointerMoved = false;
    const strokes = this.svg.querySelectorAll('path');
    gsap.killTweensOf([this.el, strokes, this.svg.querySelectorAll('.dog__dot')]);
    gsap.set(this.el, { autoAlpha: 1 });
    gsap.fromTo(strokes, { drawSVG: '0%' }, {
      drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', stagger: 0.035,
      onComplete: () => gsap.set(strokes, { clearProps: 'strokeDasharray,strokeDashoffset' }),
    });
    gsap.fromTo(this.svg.querySelectorAll('.dog__dot'), { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.8 });
    this.wagBoost = 1;
    this.syncTicker();
  };

  hide = () => {
    if (!this.visible) return;
    this.visible = false;
    this.state = 'hidden';
    this.moveTl?.kill();
    this.sitTimer?.kill();
    gsap.to(this.el, { autoAlpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => this.syncTicker() });
  };

  sit = () => {
    if (!this.visible || this.state === 'toTrack' || this.state === 'across') return;
    if (this.state === 'home') { this.wagBoost = 1; return; }
    this.state = 'sitting';
    this.vel = 0;
    this.setPose('sit');
    this.wagBoost = 1;
    this.sitTimer?.kill();
    this.sitTimer = gsap.delayedCall(2.6, () => {
      if (this.state !== 'sitting') return;
      this.setPose('stand');
      this.state = 'follow';
    });
  };

  runAcross = (): Promise<void> => {
    if (this.destroyed) return Promise.resolve();
    if (this.acrossPromise) return this.acrossPromise;
    this.acrossPromise = new Promise<void>((resolve) => {
      const { w } = this.hostSize();
      const rtl = getComputedStyle(this.host).direction !== 'ltr';
      const from = rtl ? w + 24 : -W - 24;
      const to = rtl ? -W - 24 : w + 24;
      const mid = from + (to - from) * 0.46;
      this.state = 'across';
      this.visible = true;
      this.setPose('stand', 0);
      this.x = from; this.y = this.trackY(); this.vel = 0;
      this.face(rtl ? 1 : -1);
      this.place();
      gsap.set(this.el, { autoAlpha: 1 });
      this.syncTicker();
      const pos = { x: from };
      let last = from; let lastT = performance.now();
      const track = () => {
        const now = performance.now();
        const dt = Math.max(1, now - lastT) / 1000;
        this.vel = (pos.x - last) / dt;
        last = pos.x; lastT = now;
        this.x = pos.x;
      };
      this.moveTl = gsap.timeline({
        onUpdate: track,
        onComplete: () => {
          gsap.set(this.el, { autoAlpha: 0 });
          this.visible = false; this.state = 'hidden'; this.vel = 0;
          this.syncTicker();
          resolve();
        },
      })
        .to(pos, { x: mid, duration: 2.2, ease: 'power2.out' })
        .call(() => { this.vel = 0; this.setPose('sit'); this.wagBoost = 1; })
        .to({}, { duration: 1.3 })
        .call(() => this.setPose('stand'))
        .to(pos, { x: to, duration: 1.7, ease: 'power2.in' }, '+=0.25');
    });
    return this.acrossPromise;
  };

  destroy = () => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.moveTl?.kill();
    this.sitTimer?.kill();
    gsap.ticker.remove(this.tick);
    this.ticking = false;
    this.io.disconnect();
    window.removeEventListener('pointermove', this.onPointer);
    this.host.removeEventListener('click', this.onClick);
    this.offMotion();
    gsap.killTweensOf([this.el, ...Array.from(this.svg.querySelectorAll('path, circle'))]);
    this.layer.remove();
  };

  /* ---------------- input ---------------- */
  onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.pointerX = e.clientX;
    if (!this.visible || !this.inView) return;
    if (this.state === 'home') {
      // only leave home once the cursor is actually over this host
      const r = this.host.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      if (!this.pointerMoved) { this.pointerMoved = true; this.leaveHome(); }
    }
  };
  onClick = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
    this.sit();
  };

  leaveHome() {
    this.state = 'toTrack';
    this.setPose('stand', 0.3);
    const ty = this.trackY();
    const hr = this.host.getBoundingClientRect();
    const px = this.pointerX != null ? this.pointerX - hr.left - W / 2 : this.x - 80;
    const tx = gsap.utils.clamp(8, this.hostSize().w - W - 8, this.x + gsap.utils.clamp(-160, 160, px - this.x));
    const dist = Math.hypot(tx - this.x, ty - this.y);
    const dur = gsap.utils.clamp(0.7, 1.5, dist / 360);
    this.face(tx <= this.x ? 1 : -1);
    const pos = { x: this.x, y: this.y };
    let lx = pos.x; let ly = pos.y; let lt = performance.now();
    this.moveTl?.kill();
    this.moveTl = gsap.timeline({
      delay: 0.25,
      onUpdate: () => {
        const now = performance.now(); const dt = Math.max(1, now - lt) / 1000;
        const vx = (pos.x - lx) / dt; const vy = (pos.y - ly) / dt;
        this.speed = Math.min(MAX_V, Math.hypot(vx, vy));
        // nose down while trotting downhill
        this.tilt = gsap.utils.clamp(-26, 0, -Math.atan2(Math.max(0, vy), Math.abs(vx) + 60) * 57.3);
        lx = pos.x; ly = pos.y; lt = now;
        this.x = pos.x; this.y = pos.y;
      },
      onComplete: () => { this.tilt = 0; this.vel = 0; this.state = 'follow'; },
    }).to(pos, { x: tx, y: ty, duration: dur, ease: 'power1.inOut' });
  }

  /* ---------------- frame loop ---------------- */
  syncTicker() {
    const want = this.visible && this.inView && !this.destroyed;
    if (want && !this.ticking) { gsap.ticker.add(this.tick); this.ticking = true; }
    else if (!want && this.ticking) { gsap.ticker.remove(this.tick); this.ticking = false; }
  }

  tick = (_t: number, deltaMs: number) => {
    const dt = Math.min(0.05, deltaMs / 1000);
    if (this.state === 'follow' && this.pointerX != null) {
      const hr = this.host.getBoundingClientRect();
      const target = gsap.utils.clamp(8, hr.width - W - 8, this.pointerX - hr.left - W / 2);
      const dx = target - this.x;
      const desired = Math.abs(dx) < 6 ? 0 : gsap.utils.clamp(-MAX_V, MAX_V, dx * 3.2);
      this.vel += (desired - this.vel) * Math.min(1, dt * 5);
      this.x += this.vel * dt;
      this.y = this.trackY();
      if (this.vel < -14) this.face(1); else if (this.vel > 14) this.face(-1);
      this.speed = Math.abs(this.vel);
    } else if (this.state === 'across') {
      this.speed = Math.abs(this.vel);
      if (this.vel < -14) this.face(1); else if (this.vel > 14) this.face(-1);
    } else if (this.state !== 'toTrack') {
      this.speed *= 1 - Math.min(1, dt * 8);
    }
    const n = Math.min(1, this.speed / MAX_V);
    const run = this.pose === 'stand' ? Math.min(1, n * 1.6) : 0;
    this.phase += dt * (5 + 9 * n) * Math.PI * 2 * (run > 0.02 ? 1 : 0);
    const a = 34 * run;
    const s = Math.sin(this.phase);
    const rotate = (g: SVGGElement, deg: number, p: Pt) =>
      g.setAttribute('transform', `rotate(${deg.toFixed(2)} ${p[0]} ${p[1]})`);
    rotate(this.rot.fn, a * s, PIVOT.fn);
    rotate(this.rot.ff, a * Math.sin(this.phase + 0.6), PIVOT.ff);
    rotate(this.rot.bn, -a * s, PIVOT.bn);
    rotate(this.rot.bf, -a * Math.sin(this.phase + 0.6), PIVOT.bf);
    rotate(this.rot.head, 3 * run * Math.sin(this.phase + 1.2), PIVOT.head);
    // tail: happy wag (faster + wider after a click / when sitting at home), soft sway while idle
    this.wagBoost = Math.max(0, this.wagBoost - dt * 0.35);
    const wagSpeed = this.pose === 'sit' ? 2.2 + 7 * this.wagBoost : 1.2 + 5 * run;
    this.wagPhase += dt * wagSpeed * Math.PI * 2;
    const wagAmp = this.pose === 'sit' ? 6 + 16 * this.wagBoost : 4 + 6 * run;
    const tailPivot = this.pose === 'sit' ? PIVOT.tailSit : PIVOT.tailStand;
    rotate(this.rot.tail, wagAmp * Math.sin(this.wagPhase) * (this.pose === 'sit' ? -1 : 1), tailPivot);
    const bob = -Math.abs(Math.sin(this.phase)) * 2.2 * run;
    this.body.setAttribute('transform', `translate(0 ${bob.toFixed(2)})`);
    this.svg.style.transform = this.tilt ? `rotate(${this.tilt.toFixed(1)}deg)` : '';
    this.place();
  };
}

export function mountDog(host: HTMLElement, opts: DogOptions = { mode: 'follow' }): DogHandle {
  if (!host || env.isTouch || env.isMobile() || !env.motionAllowed()) return noop();
  const dog = new Dog(host, opts);
  return { destroy: dog.destroy, runAcross: dog.runAcross, show: dog.show, hide: dog.hide, sit: dog.sit };
}
