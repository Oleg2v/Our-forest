/* ==========================================================================
   Home 2 — hero "Crown".
   One motion idea: the forest breathes. The photo sits on a WebGL plane where only the foliage moves in
   the wind (painted mask), the cursor is a gust, seasonal pollen / leaves drift with depth of field.
   "היער שלנו" grows letter by letter like sprouts; the subtitle arrives line by line, the paragraph as one
   block (it is the LCP). On scroll the photo zooms in and darkens and its bottom edge rises as a wave of
   cream that runs into the roots' cream band, down to the soil line — we go underground (roots).

   Modes (decided after the first frame, never blocking the LCP photo):
     gl     desktop tier ≥ 1, phones tier ≥ 2 (light shader, fewer particles) — one shared renderer (src/gl)
     video  phones tier < 2 / no WebGL: a 7 s wind loop rendered from the same shader (public/video)
     still  reduced motion, data saver, no WebGL on desktop: the photo (+ a slow CSS breath when motion is on)
   Contract: initHero(ready) — ready resolves when the preloader window has opened enough.
   ========================================================================== */
import './hero.css';
import { gsap, ScrollTrigger, SplitText, T, EASE } from '../../core/gsap';
import { env, gpuTier } from '../../core/env';
import { bus } from '../../core/bus';
import { he } from '../../content/he';
import { dayPeriod, seasonOf, type DayPeriod } from '../../core/format';
import { sound } from '../../core/sound';
import { scrollTo } from '../../core/scroll';
import { onPreloaderBeat, preloaderPlaying, preloaderQuiet } from './preloader';
import { preloadGL, mountHeroWind, enableRipples, disableRipples, webglAvailable, type HeroWindHandle } from '../../gl';

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
/** entrance time (s) by which the title's letters have landed (8 letters × T.letterStep + 1.25 s) */
const LETTERS_LANDED = 1.6;
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

/** portrait phones: the hero ends in a soil-coloured wave that runs straight into the roots' soil */
const PHONE_MQ = '(max-width: 768px), (max-height: 560px) and (orientation: landscape)'; // = roots' COMPACT_MQ

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
  private windPending: Promise<void> | null = null;
  private video: HTMLVideoElement | null = null;
  /** this device plays the wind loop (portrait crop only) — remembered across rotations */
  private videoWanted = false;
  private motes: HTMLElement | null = null;
  private entered = false;
  private entrance: gsap.core.Timeline | null = null;
  /** the subtitle's line split stays after the entrance (see enter()) and is undone on a width change */
  private splits: SplitText[] = [];
  private scrollTl: gsap.core.Timeline | null = null;
  private contentTw: gsap.core.Tween | null = null;
  private visible = true;
  private tiltOn = false;
  private tiltBase: [number, number] | null = null;
  private tiltSet: Array<(v: number) => void> = [];
  private groundFill: SVGPathElement | null = null;
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

    let lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      this.revertSplits();
    }, { passive: true });

    const io = new IntersectionObserver(([e]) => this.setVisible(e.isIntersecting), { rootMargin: '60px 0px' });
    io.observe(el);
    document.addEventListener('visibilitychange', () => this.syncVideo());

    // pointer handlers check this.motion themselves — bound once, so motion turned on later still gets gusts
    this.bindPointer();
    if (this.motion) {
      this.decideMode();
      this.setupScroll();
      this.setupTilt();
      ready.then(() => this.enter()).catch(() => this.enter());
    } else {
      this.staticState();
    }
    bus.on('preloader:done', () => this.afterIntro());
    bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => this.onMotion(allowed));
    // the <picture> may switch crop on rotation: the GL texture + mask must follow the displayed photo,
    // and the portrait wind loop must not keep covering a landscape crop
    this.img.addEventListener('load', () => this.onCropChange());
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
    if (!webglAvailable()) return this.setMode(this.phone ? 'video' : 'still');
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
      // Prepare now (chunk, decoded photo + mask — off the main thread); the GPU steps (compile, upload, first
      // draw) wait for the preloader's beat on the counter's last ticks, and anything still left when the window
      // starts to open waits until the layer is gone (preloaderQuiet) — a hitch never lands in the opening.
      // The beat holds the opening for the first frame at most ~0.12 s past "100".
      const p = this.mountWind();
      onPreloaderBeat(() => p);
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
    if (m === 'video') this.videoWanted = true;
    this.mode = m;
    this.el.dataset.mode = m;
    this.el.classList.toggle('hero--still', m === 'still' && this.motion);
    if (m !== 'gl') { this.wind?.destroy(); this.wind = null; }
    if (m !== 'video') { this.video?.remove(); this.video = null; }
    if (m === 'video') this.startVideo();
    if (m === 'still' || m === 'video') this.buildMotes(m === 'video' ? (this.season === 'autumn' ? 6 : 10) : (this.season === 'autumn' ? 9 : 16));
    else this.removeMotes();
  }

  /** Resolves once the first wind frame is on screen (or mounting gave up). */
  private mountWind(): Promise<void> {
    if (this.windPending) return this.windPending;
    if (this.wind || !this.motion || this.mode !== 'gl') return Promise.resolve();
    const run = async () => {
      const handle = await mountHeroWind({
        host: this.zoom, img: this.img, maskUrl: this.maskUrl(), season: this.season,
        quality: this.quality, dprCap: this.dprCap, gate: () => this.glGate(),
      });
      if (!handle) { if (this.mode === 'gl') this.setMode(this.phone ? 'video' : 'still'); return; }
      if (!this.motion || this.mode !== 'gl') { handle.destroy(); return; }
      this.wind = handle;
      // the first frame has been presented: cross-fade from the photo (identical pixels at rest)
      handle.canvas.classList.add('is-on');
      handle.setVisible(this.visible);
      if (this.entered) handle.arrive(0.1);
      if (import.meta.env.DEV) (window as any).__ofHeroWind = handle;
    };
    this.windPending = run().catch(() => undefined).finally(() => { this.windPending = null; });
    return this.windPending;
  }

  /** GPU warm-up steps may run: at the preloader's beat, or once the title's letters have landed —
      never in the ring window's opening, never under the letters rising (a texture upload is a 10–200 ms hitch). */
  private async glGate() {
    await preloaderQuiet();
    for (let i = 0; i < 6; i++) {
      const tl = this.entrance;
      if (!tl || !tl.isActive() || tl.time() >= LETTERS_LANDED) return;
      await wait(Math.max(40, ((LETTERS_LANDED - tl.time()) / (tl.timeScale() || 1)) * 1000));
    }
  }

  /** the displayed crop changed (rotation): GL follows it; the portrait-only video yields to the still photo and returns */
  private onCropChange() {
    if (this.wind) { this.wind.destroy(); this.wind = null; this.mountWind(); return; }
    if (!this.motion || !this.videoWanted) return;
    const portrait = /heroPortrait/.test(this.img.currentSrc || '');
    if (!portrait && this.mode === 'video') this.setMode('still');
    else if (portrait && this.mode === 'still') this.setMode('video');
  }

  /* ------------------------------------------------------------------ phone video loop */
  private startVideo() {
    if (this.video || !this.motion) return;
    const begin = () => {
      if (this.video || this.mode !== 'video' || !this.motion) return;
      // the loop is rendered from the portrait crop only
      if (!/heroPortrait/.test(this.img.currentSrc || '')) { this.setMode('still'); return; }
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
    // LCP: the paragraph is the largest text on the first screen. It is revealed as ONE block (opacity / y), so
    // it paints once, early and whole. A line split reverted at the end of the entrance would repaint it as a
    // new, larger LCP entry ≈ 3 s in (repeat visits, page transitions back to /). The subtitle keeps its
    // line-by-line rise, and its split is NOT reverted when the entrance ends (no late repaint either) —
    // only on a width change, when the lines would no longer match.
    const subLines = sub && sub.offsetParent
      ? (this.splits.push(SplitText.create(sub, { type: 'lines', mask: 'lines', linesClass: 'hero__line', tag: 'span', aria: 'none' })), this.splits[this.splits.length - 1].lines)
      : [] as Element[];
    const txtShown = !!(txt && txt.offsetParent);
    const greet = el.querySelector('.hero__greet');
    const buttons = el.querySelectorAll('.hero__buttons .btn');
    const gift = el.querySelector('.hero__gift');
    const small = this.phone;
    const rnd = seeded(9);

    gsap.set(chars, {
      yPercent: 118, opacity: 0, filter: `blur(${small ? 6 : 10}px)`,
      rotate: (i: number) => (i % 2 ? 1 : -1) * (5 + rnd() * 5), willChange: 'transform, filter, opacity',
    });
    gsap.set(subLines, { yPercent: 105 });
    gsap.set([greet, txtShown ? txt : null, ...buttons, gift].filter(Boolean), { opacity: 0, y: 18 });
    if (this.corner) gsap.set(this.corner, { opacity: 0, y: -8 });
    if (this.cue) gsap.set(this.cue, { opacity: 0 });
    if (this.countNum) this.countNum.textContent = '0';
    el.dataset.entrance = 'run';

    const tl = gsap.timeline({
      defaults: { ease: EASE.appear, duration: T.appear },
      onComplete: () => {
        gsap.set(chars, { clearProps: 'transform,filter,opacity,willChange' });
        if (txtShown) gsap.set(txt, { clearProps: 'transform,opacity' });
        el.dataset.entrance = 'done';
      },
    });
    tl.to(chars, { yPercent: 0, opacity: 1, rotate: 0, filter: 'blur(0px)', stagger: T.letterStep, duration: 1.25 }, 0);
    if (greet) tl.to(greet, { opacity: 1, y: 0, duration: 1 }, 0.1);
    if (subLines.length) tl.to(subLines, { yPercent: 0, stagger: T.lineStep }, 0.36);
    if (txtShown) tl.to(txt, { opacity: 1, y: 0, duration: 1.1 }, 0.46);
    tl.to(buttons, { opacity: 1, y: 0, stagger: 0.08, duration: 1 }, 0.66);
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

  private revertSplits() {
    if (this.entrance && this.entrance.progress() < 1) this.entrance.progress(1);
    this.splits.splice(0).forEach((s) => s.revert());
  }

  private afterIntro() {
    if (this.motion && !env.isTouch && !this.ripplesOn) { this.ripplesOn = true; enableRipples({ minTier: 1 }); }
  }

  /* ------------------------------------------------------------------ scroll: zoom, dim, ground */
  private setupScroll() {
    this.scrollTl?.scrollTrigger?.kill(); this.scrollTl?.kill();
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: this.el, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
    tl.fromTo(this.zoom, { scale: 1 }, { scale: 1.14, duration: 1 }, 0);
    if (this.dim) tl.fromTo(this.dim, { opacity: 0 }, { opacity: 0.62, duration: 1 }, 0);
    if (this.corner) tl.fromTo(this.corner, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0);
    if (this.cue) tl.fromTo(this.cue, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, 0);
    // explicit y: 0 — GSAP would otherwise read the CSS translate(100%) as px and add it to yPercent
    // phones start with the wavy soil edge already showing (half raised), so the hero never meets the soil on a
    // straight line; desktop keeps the full rise of the cream ground
    if (this.ground) tl.fromTo(this.ground, { y: 0, yPercent: () => (window.matchMedia(PHONE_MQ).matches ? 50 : 100) }, { y: 0, yPercent: 0, duration: 0.72 }, 0);
    this.scrollTl = tl;
    // The copy lifts and fades once the hero's bottom (the buttons) has been seen: with a 100svh hero that is the
    // same as 'top top'; when the hero is taller than the screen (min-height on short / landscape screens) the
    // buttons stay readable until they are actually reached instead of fading out below the fold.
    // autoAlpha: at 0 the copy is visibility:hidden — no invisible button under the header that still takes
    // clicks or keyboard focus; below ~.35 it already stops taking pointer hits (a faint ghost is not a target)
    this.contentTw?.scrollTrigger?.kill(); this.contentTw?.kill();
    let ghost = false;
    // Portrait phones: the copy simply scrolls away with the page — a half-faded CTA mid-scroll reads as broken
    // on a small screen (function values, re-read on every refresh, so a rotation picks the right behaviour).
    const still = () => window.matchMedia(PHONE_MQ).matches;
    this.contentTw = gsap.fromTo(this.content, { y: 0, autoAlpha: 1 }, {
      y: () => (still() ? 0 : -window.innerHeight * 0.12), autoAlpha: () => (still() ? 1 : 0), ease: 'none',
      onUpdate: () => {
        const g = Number(gsap.getProperty(this.content, 'opacity')) < 0.35;
        if (g !== ghost) { ghost = g; this.content.style.pointerEvents = g ? 'none' : ''; }
      },
      scrollTrigger: {
        trigger: this.el, start: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
        end: () => `+=${Math.round(Math.min(this.el.offsetHeight, window.innerHeight) * 0.62)}`,
      },
    });
    // keyboard: Shift+Tab back into a faded hero brings the copy back into view
    if (!this.focusBound) {
      this.focusBound = true;
      this.content.addEventListener('focusin', () => {
        if (this.motion && window.scrollY > 4 && this.el.getBoundingClientRect().top < 0) scrollTo(0, { immediate: true, offset: 0 });
      });
    }
  }
  private focusBound = false;

  /* ------------------------------------------------------------------ the bottom edge */
  /* On scroll the photo's bottom edge rises as a wave of cream — the page's ground colour, which runs on
     unbroken into the roots section's cream band and down to its soil line. That soil line (grass, the
     sapling photo across it) is the ONE horizon of the descent; this edge carries no line or grass of its
     own, so the page never reads ground → sky → ground. */
  private buildGround() {
    const host = this.ground; if (!host) return;
    const w = Math.round(host.clientWidth || window.innerWidth);
    const h = Math.round(host.clientHeight || 160);
    if (w < 10 || h < 10) return;
    const mobile = window.matchMedia(PHONE_MQ).matches;
    // the header's tone probe: cream earth on desktop → dark header text; soil earth on phones → light text
    host.dataset.header = mobile ? 'light' : 'dark';
    const key = `${w}x${h}${mobile ? 'm' : ''}`;
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    const base = h * 0.44;
    const A = h * (mobile ? 0.13 : 0.17);
    const y = (x: number) => {
      const u = x / w;
      return base + A * (0.62 * Math.sin(u * Math.PI * (mobile ? 1.4 : 2.1) + 0.9) + 0.28 * Math.sin(u * Math.PI * (mobile ? 3.1 : 4.6) + 2.4) + 0.1 * Math.sin(u * Math.PI * 11 + 0.3));
    };
    const step = 12;
    let d = `M${-8} ${y(-8).toFixed(1)}`;
    for (let x = step - 8; x <= w + 8; x += step) d += `L${x} ${y(x).toFixed(1)}`;
    d += `L${w + 8} ${h + 4}L-8 ${h + 4}Z`;
    // phones: a few line-drawn grass tufts on the soil's edge (the same line language as the roots)
    let grass = '';
    if (mobile) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let x = 14 + rnd() * 20; x < w - 10; x += 38 + rnd() * 46) {
        const gy = y(x) + 1.5;
        const n = 2 + Math.floor(rnd() * 3);
        for (let b = 0; b < n; b++) {
          const bx = x + (b - n / 2) * 3;
          const bh = (7 + rnd() * 11) * (b === 1 ? 1.2 : 1);
          const lean = (rnd() - 0.5) * 12;
          grass += `M${bx.toFixed(1)} ${gy.toFixed(1)}Q${(bx + lean * 0.2).toFixed(1)} ${(gy - bh * 0.55).toFixed(1)} ${(bx + lean).toFixed(1)} ${(gy - bh).toFixed(1)}`;
        }
      }
    }
    if (!this.groundFill) {
      host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" focusable="false"><path class="hero__ground-fill"/><path class="hero__ground-grass"/></svg>`;
      this.groundFill = host.querySelector('.hero__ground-fill');
    }
    host.firstElementChild!.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.groundFill!.setAttribute('d', d);
    host.querySelector('.hero__ground-grass')?.setAttribute('d', grass || 'M0 0');
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
  private tiltBound = false;
  /** idempotent: shows the pill (motion on) and binds it once */
  private setupTilt() {
    const btn = this.tiltBtn;
    if (!btn || !env.isTouch || typeof window.DeviceOrientationEvent === 'undefined') return;
    btn.hidden = !this.motion;
    if (this.tiltBound) return;
    this.tiltBound = true;
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
    this.revertSplits();
    this.el.dataset.entrance = 'static';
    this.content.style.pointerEvents = '';
    if (this.countNum) this.countNum.textContent = String(he.hero.counterValue);
    gsap.set([this.content, this.corner, this.cue, this.ground, this.zoom, this.dim, this.media].filter(Boolean), { clearProps: 'all' });
  }

  private onMotion(allowed: boolean) {
    if (allowed === this.motion) return;
    this.motion = allowed;
    if (!allowed) {
      if (this.tiltOn) this.stopTilt();
      if (this.tiltBtn) this.tiltBtn.hidden = true; // tilt is motion — no control that does nothing
      this.scrollTl?.scrollTrigger?.kill(); this.scrollTl?.kill(); this.scrollTl = null;
      this.contentTw?.scrollTrigger?.kill(); this.contentTw?.kill(); this.contentTw = null;
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
      this.setupTilt();
      ScrollTrigger.refresh();
      this.afterIntro();
    }
  }
}
