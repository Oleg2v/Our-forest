/* ==========================================================================
   Home 2 — hero "Crown".
   One motion idea: the forest breathes. The photo sits on a WebGL plane where only the foliage moves in
   the wind (painted mask), the cursor is a gust, seasonal pollen / leaves drift with depth of field.
   "היער שלנו" grows letter by letter like sprouts; the rest arrives line by line. On scroll the photo
   zooms in and darkens and its bottom edge rises as the earth surface — we go underground (roots).

   Modes (decided after the first frame, never blocking the LCP photo):
     gl     desktop tier ≥ 1, phones tier ≥ 2 (light shader, fewer particles) — one shared renderer (src/gl)
     video  phones tier < 2 / no WebGL: a 7 s wind loop rendered from the same shader (public/video)
     still  reduced motion, data saver, no WebGL on desktop: the photo (+ a slow CSS breath when motion is on)
   Contract: initHero(ready) — ready resolves when the preloader window has opened enough.
   ========================================================================== */
import './hero.css';
import { gsap, ScrollTrigger, SplitText, T, EASE } from '../../core/gsap';
import { env, gpuTier, hasWebGL } from '../../core/env';
import { bus } from '../../core/bus';
import { he } from '../../content/he';
import { dayPeriod, seasonOf, type DayPeriod } from '../../core/format';
import { sound } from '../../core/sound';
import { onPreloaderBeat, preloaderPlaying } from './preloader';
import { preloadGL, mountHeroWind, enableRipples, disableRipples, type HeroWindHandle } from '../../gl';

type Mode = 'gl' | 'video' | 'still';

const MASK_LANDSCAPE = '/img/hero-mask.png';
const MASK_PORTRAIT = '/img/hero-mask-portrait.png';
const VIDEO = { webm: '/video/hero-loop.webm', mp4: '/video/hero-loop.mp4' };

/* time-of-day line icons (24 viewBox, stroke 1.5, round) */
const ICONS: Record<DayPeriod, string> = {
  morning: '<path d="M3 17.5h18"/><path d="M7 17.5a5 5 0 0 1 10 0"/><path d="M12 6v2.6"/><path d="m5.3 9.8 1.8 1.6"/><path d="m18.7 9.8-1.8 1.6"/><path d="M7.5 21h9"/>',
  noon: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M5.5 18.5l1.6-1.6M16.9 7.1l1.6-1.6"/>',
  evening: '<path d="M3 15.5h18"/><path d="M7.5 15.5a4.5 4.5 0 0 1 9 0"/><path d="M6 19h12"/><path d="M9 22h6"/><path d="M12 5v2.5"/><path d="m6.6 8.4 1.4 1.3"/><path d="m17.4 8.4-1.4 1.3"/>',
  night: '<path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6.1 6.1 0 0 0 10.1 10.1Z"/><path d="M17 4.2v2.6M15.7 5.5h2.6"/>',
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function seeded(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const getCopy = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);

export function initHero(ready: Promise<void>): void {
  const el = document.querySelector<HTMLElement>('.hero');
  if (!el) return;
  try { new Hero(el, ready); } catch (e) {
    console.error('[hero]', e);
    el.dataset.entrance = 'static';
  }
}

class Hero {
  private el: HTMLElement;
  private media: HTMLElement;
  private zoom: HTMLElement;
  private img: HTMLImageElement;
  private dim: HTMLElement | null;
  private content: HTMLElement;
  private corner: HTMLElement | null;
  private ground: HTMLElement | null;
  private cue: HTMLElement | null;
  private countNum: HTMLElement | null;
  private tiltBtn: HTMLButtonElement | null;
  private motion = env.motionAllowed();
  private phone = env.isTouch && window.matchMedia('(max-width: 900px)').matches;
  private season = (import.meta.env.DEV && (new URLSearchParams(location.search).get('season') as ReturnType<typeof seasonOf> | null)) || seasonOf();
  private mode: Mode | null = null;
  private quality: 'full' | 'light' = 'light';
  private dprCap = 1;
  private glLoaded = false;
  private wind: HeroWindHandle | null = null;
  private windPending = false;
  private video: HTMLVideoElement | null = null;
  private motes: HTMLElement | null = null;
  private entered = false;
  private entrance: gsap.core.Timeline | null = null;
  private scrollTl: gsap.core.Timeline | null = null;
  private visible = true;
  private tiltOn = false;
  private tiltBase: [number, number] | null = null;
  private tiltSet: Array<(v: number) => void> = [];
  private groundParts: { edge: SVGPathElement; fill: SVGPathElement; grass: SVGGElement } | null = null;
  private ripplesOn = false;

  constructor(el: HTMLElement, ready: Promise<void>) {
    this.el = el;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s);
    this.media = q<HTMLElement>('[data-hero-media]')!;
    this.zoom = q<HTMLElement>('[data-hero-zoom]')!;
    this.img = q<HTMLImageElement>('[data-hero-img]')!;
    this.content = q<HTMLElement>('[data-hero-content]')!;
    this.dim = q('[data-hero-dim]');
    this.corner = q('[data-hero-corner]');
    this.ground = q('[data-hero-ground]');
    this.cue = q('.hero__cue');
    this.countNum = q('[data-hero-count-num]');
    this.tiltBtn = q('[data-hero-tilt]');
    if (!this.media || !this.zoom || !this.img || !this.content) throw new Error('hero markup');

    this.syncCopy();
    this.buildGround();
    ScrollTrigger.addEventListener('refreshInit', () => this.buildGround());

    const io = new IntersectionObserver(([e]) => this.setVisible(e.isIntersecting), { rootMargin: '60px 0px' });
    io.observe(el);
    document.addEventListener('visibilitychange', () => this.syncVideo());

    if (this.motion) {
      this.decideMode();
      this.setupScroll();
      this.bindPointer();
      this.setupTilt();
      ready.then(() => this.enter()).catch(() => this.enter());
    } else {
      this.staticState();
    }
    bus.on('preloader:done', () => this.afterIntro());
    bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => this.onMotion(allowed));
    // the <picture> may switch crop on rotation: the GL texture + mask must follow the displayed photo
    this.img.addEventListener('load', () => { if (this.wind) { this.wind.destroy(); this.wind = null; this.mountWind(); } });
  }

  /* ------------------------------------------------------------------ copy */
  private syncCopy() {
    this.el.querySelectorAll<HTMLElement>('[data-he]').forEach((n) => {
      const v = getCopy(n.dataset.he!);
      if (typeof v === 'string' && n.textContent !== v) n.textContent = v;
    });
    const greet = this.el.querySelector<HTMLElement>('[data-hero-greet]');
    const period = dayPeriod();
    const text = greet?.querySelector('[data-hero-greet-text]');
    const icon = greet?.querySelector('[data-hero-greet-icon]');
    if (greet && text) {
      text.textContent = he.hero.greetings[period];
      if (icon) icon.innerHTML = ICONS[period];
      greet.classList.add('is-ready');
    }
    const count = this.el.querySelector<HTMLElement>('[data-hero-count]');
    if (count && this.countNum) {
      const [pre, post] = he.hero.counter('\u0000').split('\u0000');
      this.countNum.textContent = String(he.hero.counterValue);
      count.replaceChildren(document.createTextNode(pre), this.countNum, document.createTextNode(post));
    }
  }

  /* ------------------------------------------------------------------ mode */
  private async decideMode() {
    if (env.saveData) return this.setMode('still');
    if (!hasWebGL()) return this.setMode(this.phone ? 'video' : 'still');
    if (!this.phone) this.loadGL(); // desktop is almost always GL: fetch the chunk in parallel with the tier test
    // warm the mask in the HTTP cache (TextureLoader will hit it)
    const warm = new Image(); warm.decoding = 'async'; warm.src = this.maskUrl();
    let tier = 1;
    try { tier = (await gpuTier()).tier; } catch { /* keep 1 */ }
    if (!this.motion) return;
    // dev: ?mode=gl|video|still forces a path (headless browsers report a weak GPU)
    const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('mode') as Mode | null : null;
    if (forced) this.setMode(forced);
    else if (this.phone) this.setMode(tier >= 2 ? 'gl' : 'video');
    else this.setMode(tier >= 1 ? 'gl' : 'still');
    this.quality = !this.phone && tier >= 2 ? 'full' : 'light';
    this.dprCap = this.phone ? 2 : tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1;
    if (this.mode !== 'gl') return;
    this.loadGL();
    if (preloaderPlaying()) {
      // compile + upload behind the still frame at 100 — only if the chunk is already here
      onPreloaderBeat(() => (this.glLoaded ? this.mountWind() : undefined));
      // otherwise right after the intro
      bus.on('preloader:done', () => { if (!this.wind) requestAnimationFrame(() => this.mountWind()); });
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => this.mountWind()));
    }
  }

  private loadGL() {
    preloadGL().then(() => { this.glLoaded = true; }).catch(() => { if (this.mode === 'gl') this.setMode(this.phone ? 'video' : 'still'); });
  }

  private maskUrl() { return /heroPortrait/.test(this.img.currentSrc || '') ? MASK_PORTRAIT : MASK_LANDSCAPE; }

  private setMode(m: Mode) {
    if (this.mode === m) return;
    this.mode = m;
    this.el.dataset.mode = m;
    this.el.classList.toggle('hero--still', m === 'still' && this.motion);
    if (m !== 'gl') { this.wind?.destroy(); this.wind = null; }
    if (m === 'video') this.startVideo();
    if (m === 'still' || m === 'video') this.buildMotes(m === 'video' ? (this.season === 'autumn' ? 6 : 10) : (this.season === 'autumn' ? 9 : 16));
    else this.removeMotes();
  }

  private async mountWind() {
    if (this.wind || this.windPending || !this.motion || this.mode !== 'gl') return;
    this.windPending = true;
    const handle = await mountHeroWind({
      host: this.zoom, img: this.img, maskUrl: this.maskUrl(), season: this.season,
      quality: this.quality, dprCap: this.dprCap,
      onFirstFrame: () => requestAnimationFrame(() => this.zoom.querySelector('.gl-stage')?.classList.add('is-on')),
    });
    this.windPending = false;
    if (!handle) { if (this.mode === 'gl') this.setMode(this.phone ? 'video' : 'still'); return; }
    if (!this.motion || this.mode !== 'gl') { handle.destroy(); return; }
    this.wind = handle;
    handle.setVisible(this.visible);
    if (this.entered) handle.arrive(0.1);
    if (import.meta.env.DEV) (window as any).__ofHeroWind = handle;
  }

  /* ------------------------------------------------------------------ phone video loop */
  private startVideo() {
    if (this.video || !this.motion) return;
    const begin = () => {
      if (this.video || this.mode !== 'video' || !this.motion) return;
      // the loop is rendered from the portrait crop only
      if (!/heroPortrait/.test(this.img.currentSrc || '')) { this.mode = null; this.setMode('still'); return; }
      const v = document.createElement('video');
      v.className = 'hero__video';
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.setAttribute('disablepictureinpicture', ''); v.setAttribute('disableremoteplayback', '');
      v.poster = this.img.currentSrc;
      v.innerHTML = `<source src="${VIDEO.webm}" type="video/webm; codecs=vp9"><source src="${VIDEO.mp4}" type="video/mp4">`;
      v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
      v.addEventListener('error', () => v.remove(), { once: true });
      this.zoom.appendChild(v);
      this.video = v;
      this.syncVideo();
    };
    // never compete with the LCP photo: after the intro (or now if it is already over)
    if (preloaderPlaying()) bus.on('preloader:done', () => setTimeout(begin, 300));
    else setTimeout(begin, 600);
  }
  private syncVideo() {
    const v = this.video; if (!v) return;
    if (this.visible && !document.hidden && this.motion) v.play().catch(() => undefined);
    else v.pause();
  }

  /* ------------------------------------------------------------------ CSS motes (fallback particles) */
  private buildMotes(n: number) {
    this.removeMotes();
    if (!this.motion) return;
    const leaves = this.season === 'autumn';
    const rnd = seeded(77 + n);
    const wrap = document.createElement('div');
    wrap.className = `hero__motes${leaves ? ' hero__motes--leaves' : ''}`;
    wrap.setAttribute('aria-hidden', 'true');
    const colors = ['var(--olive)', 'var(--bark)', 'var(--olive-deep)'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'hero__mote';
      const depth = rnd();
      const dur = leaves ? 12 + rnd() * 9 : 16 + rnd() * 14;
      s.style.cssText = [
        `--x:${(rnd() * 100).toFixed(1)}%`, `--y:${(leaves ? -8 + rnd() * 50 : 18 + rnd() * 70).toFixed(1)}%`,
        `--s:${(leaves ? 9 + depth * 16 : 3 + depth * 7).toFixed(1)}px`, `--dur:${dur.toFixed(1)}s`,
        `--delay:${(-rnd() * dur).toFixed(1)}s`, `--b:${depth > 0.82 ? 2.5 : depth < 0.2 ? 1 : 0}px`,
        `--o:${(0.35 + depth * 0.45).toFixed(2)}`, `--c:${colors[i % 3]}`,
      ].join(';');
      wrap.appendChild(s);
    }
    this.dim?.after(wrap);
    this.motes = wrap;
  }
  private removeMotes() { this.motes?.remove(); this.motes = null; }

  /* ------------------------------------------------------------------ visibility */
  private setVisible(v: boolean) {
    this.visible = v;
    this.wind?.setVisible(v);
    this.syncVideo();
    this.motes?.style.setProperty('animation-play-state', v ? 'running' : 'paused');
    this.motes?.querySelectorAll<HTMLElement>('.hero__mote').forEach((m) => { m.style.animationPlayState = v ? 'running' : 'paused'; });
  }

  /* ------------------------------------------------------------------ entrance */
  private splitTitle(): HTMLElement[] {
    const chars: HTMLElement[] = [];
    this.el.querySelectorAll<HTMLElement>('.hero__word-in').forEach((w) => {
      const text = w.textContent ?? '';
      w.replaceChildren(...Array.from(text).map((ch) => {
        const s = document.createElement('span');
        s.className = 'hero__char';
        s.textContent = ch;
        chars.push(s);
        return s;
      }));
    });
    return chars;
  }

  private async enter() {
    if (this.entered) return;
    this.entered = true;
    if (!this.motion) { this.staticState(); return; }
    // line splitting needs the real font metrics (repeat visits may arrive here before fonts)
    if (document.fonts && document.fonts.status !== 'loaded') await Promise.race([document.fonts.ready, wait(700)]);
    if (!this.motion) { this.staticState(); return; }

    const el = this.el;
    const chars = this.splitTitle();
    const sub = el.querySelector<HTMLElement>('.hero__subtitle');
    const txt = el.querySelector<HTMLElement>('.hero__text');
    const splits: SplitText[] = [];
    const lines = (n: HTMLElement | null) => {
      if (!n || !n.offsetParent) return [] as Element[];
      const s = SplitText.create(n, { type: 'lines', mask: 'lines', linesClass: 'hero__line' });
      splits.push(s);
      return s.lines;
    };
    const subLines = lines(sub);
    const txtLines = lines(txt);
    const greet = el.querySelector('.hero__greet');
    const buttons = el.querySelectorAll('.hero__buttons .btn');
    const gift = el.querySelector('.hero__gift');
    const small = this.phone;
    const rnd = seeded(9);

    gsap.set(chars, {
      yPercent: 118, opacity: 0, filter: `blur(${small ? 6 : 10}px)`,
      rotate: (i: number) => (i % 2 ? 1 : -1) * (5 + rnd() * 5), willChange: 'transform, filter, opacity',
    });
    gsap.set([...subLines, ...txtLines], { yPercent: 105 });
    gsap.set([greet, ...buttons, gift].filter(Boolean), { opacity: 0, y: 18 });
    if (this.corner) gsap.set(this.corner, { opacity: 0, y: -8 });
    if (this.cue) gsap.set(this.cue, { opacity: 0 });
    if (this.countNum) this.countNum.textContent = '0';
    el.dataset.entrance = 'run';

    const tl = gsap.timeline({
      defaults: { ease: EASE.appear, duration: T.appear },
      onComplete: () => {
        gsap.set(chars, { clearProps: 'transform,filter,opacity,willChange' });
        splits.forEach((s) => s.revert());
        el.dataset.entrance = 'done';
      },
    });
    tl.to(chars, { yPercent: 0, opacity: 1, rotate: 0, filter: 'blur(0px)', stagger: T.letterStep, duration: 1.25 }, 0);
    if (greet) tl.to(greet, { opacity: 1, y: 0, duration: 1 }, 0.1);
    if (subLines.length) tl.to(subLines, { yPercent: 0, stagger: T.lineStep }, 0.42);
    if (txtLines.length) tl.to(txtLines, { yPercent: 0, stagger: T.lineStep }, 0.56);
    tl.to(buttons, { opacity: 1, y: 0, stagger: 0.08, duration: 1 }, 0.72);
    if (gift) tl.to(gift, { opacity: 1, y: 0, duration: 1 }, 0.9);
    if (this.corner) tl.to(this.corner, { opacity: 1, y: 0, duration: 1 }, 0.95);
    if (this.countNum) {
      const n = { v: 0 };
      const target = he.hero.counterValue;
      tl.to(n, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { this.countNum!.textContent = String(Math.round(n.v)); } }, 1.0);
    }
    if (this.cue) tl.to(this.cue, { opacity: 1, duration: 1 }, 1.3);
    this.entrance = tl;
    if (import.meta.env.DEV && location.search.includes('plpause')) { tl.pause(); (window as any).__ofHeroEntrance = tl; }
    this.wind?.arrive(0.05);
    this.afterIntro();
  }

  private afterIntro() {
    if (this.motion && !env.isTouch && !this.ripplesOn) { this.ripplesOn = true; enableRipples({ minTier: 1 }); }
  }

  /* ------------------------------------------------------------------ scroll: zoom, dim, ground */
  private setupScroll() {
    this.scrollTl?.scrollTrigger?.kill(); this.scrollTl?.kill();
    const g = this.groundParts;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: this.el, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
    tl.fromTo(this.zoom, { scale: 1 }, { scale: 1.14, duration: 1 }, 0);
    if (this.dim) tl.fromTo(this.dim, { opacity: 0 }, { opacity: 0.62, duration: 1 }, 0);
    tl.fromTo(this.content, { y: 0, opacity: 1 }, { y: () => -window.innerHeight * 0.12, opacity: 0, duration: 0.62 }, 0);
    if (this.corner) tl.fromTo(this.corner, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0);
    if (this.cue) tl.fromTo(this.cue, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, 0);
    // explicit y: 0 — GSAP would otherwise read the CSS translate(100%) as px and add it to yPercent
    if (this.ground) tl.fromTo(this.ground, { y: 0, yPercent: 100 }, { y: 0, yPercent: 0, duration: 0.72 }, 0);
    if (g) {
      tl.fromTo(g.edge, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.6 }, 0.02);
      tl.fromTo(g.grass, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.32);
    }
    this.scrollTl = tl;
  }

  /* ------------------------------------------------------------------ the earth surface */
  private buildGround() {
    const host = this.ground; if (!host) return;
    const w = Math.round(host.clientWidth || window.innerWidth);
    const h = Math.round(host.clientHeight || 160);
    if (w < 10 || h < 10) return;
    const key = `${w}x${h}`;
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    const mobile = w < 769;
    const rnd = seeded(41);
    const base = h * 0.44;
    const A = h * (mobile ? 0.13 : 0.17);
    const y = (x: number) => {
      const u = x / w;
      return base + A * (0.62 * Math.sin(u * Math.PI * (mobile ? 1.4 : 2.1) + 0.9) + 0.28 * Math.sin(u * Math.PI * (mobile ? 3.1 : 4.6) + 2.4) + 0.1 * Math.sin(u * Math.PI * 11 + 0.3));
    };
    const step = 12;
    let edge = `M${-8} ${y(-8).toFixed(1)}`;
    for (let x = step - 8; x <= w + 8; x += step) edge += `L${x} ${y(x).toFixed(1)}`;
    const fill = `${edge}L${w + 8} ${h + 4}L-8 ${h + 4}Z`;
    // grass tufts + a few sprouts in the shared line style
    let grass = '';
    // sparse: the roots section below draws its own grass line — this edge only hints at the surface
    const tufts = Math.round(w / (mobile ? 130 : 150));
    for (let i = 0; i < tufts; i++) {
      const x = rnd() * w; const y0 = y(x) + 0.5;
      const blades = 2 + Math.floor(rnd() * 2);
      for (let b = 0; b < blades; b++) {
        const hb = 5 + rnd() * (mobile ? 7 : 10);
        const lean = -2.5 - rnd() * 4 + b * 2.2;
        const x0 = x + (b - 1) * 2.4;
        grass += `M${x0.toFixed(1)} ${y0.toFixed(1)}q${(lean * 0.3).toFixed(1)} ${(-hb * 0.55).toFixed(1)} ${lean.toFixed(1)} ${(-hb).toFixed(1)}`;
      }
    }
    for (const u of mobile ? [0.22, 0.71] : [0.14, 0.47, 0.81]) {
      const x = u * w; const y0 = y(x) + 0.5; const s = mobile ? 0.8 : 1;
      grass += `M${x} ${y0}c0-${8 * s} ${1.5 * s}-${15 * s} ${0.5 * s}-${22 * s}`;
      grass += `M${x + 0.6 * s} ${y0 - 14 * s}c-${2 * s}-${5 * s}-${7 * s}-${7 * s}-${11 * s}-${6 * s}c${1 * s} ${4 * s} ${6 * s} ${7 * s} ${11 * s} ${6 * s}Z`;
      grass += `M${x + 0.6 * s} ${y0 - 19 * s}c${2 * s}-${4 * s} ${6 * s}-${6 * s} ${9 * s}-${5 * s}c-${1 * s} ${3.5 * s}-${5 * s} ${5.5 * s}-${9 * s} ${5 * s}Z`;
    }
    if (!this.groundParts) {
      host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" focusable="false"><path class="hero__ground-fill"/><g class="hero__ground-grass"><path/></g><path class="hero__ground-edge"/></svg>`;
      const svg = host.firstElementChild as SVGSVGElement;
      this.groundParts = {
        fill: svg.querySelector('.hero__ground-fill')!,
        edge: svg.querySelector('.hero__ground-edge')!,
        grass: svg.querySelector('.hero__ground-grass')!,
      };
    }
    const svg = host.firstElementChild as SVGSVGElement;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.groundParts.fill.setAttribute('d', fill);
    this.groundParts.edge.setAttribute('d', edge);
    this.groundParts.grass.firstElementChild!.setAttribute('d', grass);
  }

  /* ------------------------------------------------------------------ pointer = gust */
  private bindPointer() {
    let lx = 0, ly = 0, lt = 0, lastRustle = 0;
    this.el.addEventListener('pointermove', (e) => {
      if (!this.motion) return;
      this.wind?.pointer(e.clientX, e.clientY);
      const now = performance.now();
      const dt = now - lt;
      if (lt && dt > 0 && dt < 80 && this.wind && e.pointerType === 'mouse') {
        const sp = Math.hypot(e.clientX - lx, e.clientY - ly) / dt;
        if (sp > 2.6 && now - lastRustle > 4000) { lastRustle = now; sound.play('rustle', { volume: 0.32 }); }
      }
      lx = e.clientX; ly = e.clientY; lt = now;
    }, { passive: true });
    // phones: a tap on the crown is a puff of wind (not on links/buttons)
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.motion || e.pointerType === 'mouse' || !this.wind) return;
      if ((e.target as Element | null)?.closest?.('a, button')) return;
      this.wind.puff(e.clientX, e.clientY);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ device tilt (phones, opt-in) */
  private setupTilt() {
    const btn = this.tiltBtn;
    if (!btn || !env.isTouch || typeof window.DeviceOrientationEvent === 'undefined') return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      if (this.tiltOn) { this.stopTilt(); return; }
      const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
      if (typeof DOE.requestPermission === 'function') {
        try { if ((await DOE.requestPermission()) !== 'granted') return; } catch { return; }
      }
      this.startTilt();
    });
  }
  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    if (!this.tiltBase) this.tiltBase = [e.gamma, e.beta];
    const x = clamp((e.gamma - this.tiltBase[0]) / 22, -1, 1);
    const yv = clamp((e.beta - this.tiltBase[1]) / 22, -1, 1);
    const [mx, my, cx, cy] = this.tiltSet;
    mx?.(-x * 12); my?.(-yv * 10); cx?.(x * 1.6); cy?.(yv * 0.9);
    this.wind?.setTilt(x, yv);
  };
  private startTilt() {
    if (!this.motion) return;
    this.tiltOn = true;
    this.tiltBase = null;
    this.tiltBtn?.setAttribute('aria-pressed', 'true');
    gsap.to(this.media, { scale: 1.05, duration: T.ui, ease: EASE.soft });
    const opts = { duration: 0.7, ease: 'power3.out' };
    // content moves with xPercent/yPercent so it never fights the scroll-driven y
    this.tiltSet = [gsap.quickTo(this.media, 'x', opts), gsap.quickTo(this.media, 'y', opts), gsap.quickTo(this.content, 'xPercent', opts), gsap.quickTo(this.content, 'yPercent', opts)];
    window.addEventListener('deviceorientation', this.onOrient);
  }
  private stopTilt() {
    this.tiltOn = false;
    window.removeEventListener('deviceorientation', this.onOrient);
    this.tiltBtn?.setAttribute('aria-pressed', 'false');
    this.tiltSet.forEach((f) => f(0));
    this.tiltSet = [];
    gsap.to(this.media, { scale: 1, x: 0, y: 0, duration: T.ui, ease: EASE.soft });
    gsap.to(this.content, { xPercent: 0, yPercent: 0, duration: T.ui, ease: EASE.soft });
    this.wind?.setTilt(0, 0);
  }

  /* ------------------------------------------------------------------ reduced motion */
  private staticState() {
    this.entrance?.progress(1).kill(); this.entrance = null;
    this.el.dataset.entrance = 'static';
    if (this.countNum) this.countNum.textContent = String(he.hero.counterValue);
    gsap.set([this.content, this.corner, this.cue, this.ground, this.zoom, this.dim, this.media].filter(Boolean), { clearProps: 'all' });
    if (this.groundParts) gsap.set([this.groundParts.edge, this.groundParts.grass], { clearProps: 'all' });
  }

  private onMotion(allowed: boolean) {
    if (allowed === this.motion) return;
    this.motion = allowed;
    if (!allowed) {
      if (this.tiltOn) this.stopTilt();
      this.scrollTl?.scrollTrigger?.kill(); this.scrollTl?.kill(); this.scrollTl = null;
      this.wind?.destroy(); this.wind = null;
      this.video?.remove(); this.video = null;
      this.removeMotes();
      this.el.classList.remove('hero--still');
      this.mode = null; delete this.el.dataset.mode;
      if (this.ripplesOn) { disableRipples(); this.ripplesOn = false; }
      this.staticState();
    } else {
      this.el.dataset.entrance = 'done';
      this.decideMode();
      this.setupScroll();
      ScrollTrigger.refresh();
      this.afterIntro();
    }
  }
}
