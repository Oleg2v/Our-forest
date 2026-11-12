/* ==========================================================================
   Home 0 — preloader "טבעות שנים" (tree rings).
   The rings and the 0→100 counter start at first paint from inline CSS (partials/home/preloader.html),
   independent of this bundle. This module decides WHEN the ring window opens:
     the moment "100" lands on screen  +  hero photo decoded (capped)  +  "beat" hooks (WebGL warm-up, capped)
   then the rings expand and the hero opens through a circular window (clip-path: circle) centred on the
   pith. The returned promise resolves mid-opening — the moment the hero entrance should start.
   ≤ 2.2 s in total: 100 shows at ≈ 1.16 s (the counter's ease lands on 100 before its end time), the opening
   takes 0.8 s and moves from its first frame (no dead beat at 100). Beat hooks run from ≈ 0.1 s before 100,
   while the counter only ticks its last digits, and may hold the opening at most ≈ 0.12 s past 100.
   Skipped (resolves at once) on a repeat visit in this session, after an in-site page transition, on deep
   links, and with reduced motion. Emits bus 'preloader:done' when the layer is gone.
   Heavy work elsewhere (WebGL compile / texture upload) can wait for a quiet moment with preloaderQuiet().
   ========================================================================== */
import './preloader.css';
import { gsap, CustomEase } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { session } from '../../core/storage';
import { lockScroll, unlockScroll } from '../../core/scroll';

const KEY = 'preloader';
const OPEN = 0.8;           // window opening (s) — the ease's last 10 % barely moves, so the layer goes at OPEN
const RESOLVE_AT = 0.34;    // hero entrance starts this far into the opening (s)
const BEAT_LEAD = 110;      // beat hooks start this long before "100" shows (ms) — the counter is on its last ticks
const BEAT_CAP = 120;       // …and may hold the opening at most this long after "100" (ms)
const IMG_CAP = 420;        // the hero photo (LCP) may hold the opening at most this long after "100" (ms)
/** fraction of pl-count's duration at which the eased integer counter first shows 100 (cubic-bezier(.4,.06,.3,1) = .995) */
const HUNDRED_AT = 0.9146;
// moves from its first frame (≈ power2 for the first 100 ms), most of the reveal in the first half, long soft settle
const OPEN_EASE = CustomEase.create('plOpen', 'M0,0 C0.5,0.04 0.2,1 1,1');

type Beat = () => unknown;
const beats: Beat[] = [];
type Phase = 'idle' | 'drawing' | 'beat' | 'opening' | 'done';
let phase: Phase = 'idle';
const phaseWaiters: Array<() => void> = [];
function setPhase(p: Phase) { phase = p; phaseWaiters.splice(0).forEach((f) => f()); }

/** Run fn at the "beat" (just before the window opens). Ignored once done. */
export function onPreloaderBeat(fn: Beat) { if (phase !== 'done') beats.push(fn); }
/** true while the ring layer covers the page */
export function preloaderPlaying() { return phase === 'drawing' || phase === 'beat' || phase === 'opening'; }
/** Resolves when a main-thread / GPU hitch would not show: now (no intro, or the still beat at 100),
    otherwise at the beat (while the rings draw) or once the layer is gone (while the window opens). */
export function preloaderQuiet(): Promise<void> {
  const quiet = () => phase === 'idle' || phase === 'beat' || phase === 'done';
  if (quiet()) return Promise.resolve();
  return new Promise<void>((res) => {
    const check = () => { if (quiet()) res(); else phaseWaiters.push(check); };
    phaseWaiters.push(check);
  });
}

/* ---- touch-scroll quiet ----------------------------------------------------------------------------------
   Phones: deferred work (section inits, ScrollTrigger.refresh) never runs under the finger or during momentum.
   A main-thread task that lands mid-swipe is a dropped frame the user feels; the same task 200 ms later is not. */
let touches = 0;
let lastScrollAt = 0;
let lastTouchAt = 0;
let tracking = false;
function trackTouch() {
  if (tracking || typeof window === 'undefined') return;
  tracking = true;
  const opt: AddEventListenerOptions = { passive: true, capture: true };
  const down = (e: TouchEvent) => { touches = e.touches.length; lastTouchAt = performance.now(); };
  const up = (e: TouchEvent) => { touches = e.touches.length; lastScrollAt = lastTouchAt = performance.now(); };
  window.addEventListener('touchstart', down, opt);
  window.addEventListener('touchmove', down, opt);
  window.addEventListener('touchend', up, opt);
  window.addEventListener('touchcancel', up, opt);
  window.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, opt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) touches = 0; });
}
/** a finger is down — unless nothing has moved for 3 s (a lost touchend must never hold deferred work forever) */
const fingerDown = () => touches > 0 && performance.now() - Math.max(lastTouchAt, lastScrollAt) < 3000;
/** no finger on the screen and no scroll (momentum included) for `gap` ms */
export function scrollQuiet(gap = 180): boolean {
  trackTouch();
  return !fingerDown() && performance.now() - lastScrollAt >= gap;
}
type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
/** Runs fn at the next scroll-quiet moment (see scrollQuiet), in idle time where the browser offers it. */
export function whenScrollQuiet(fn: () => void, gap = 180): void {
  trackTouch();
  const ric = (window as IdleWin).requestIdleCallback;
  const go = () => (scrollQuiet(gap) ? fn() : check());
  const check = () => {
    const wait = fingerDown() ? 120 : gap - (performance.now() - lastScrollAt);
    if (wait > 0) { window.setTimeout(check, Math.max(40, wait)); return; }
    if (ric) ric(go, { timeout: 300 });
    else requestAnimationFrame(() => window.setTimeout(go, 0));
  };
  check();
}

/** timing marks (DevTools Performance panel / RUM): of:preloader:init|shows100 (predicted)|beat|100|open|done */
const mark = (k: string) => { try { performance.mark(`of:preloader:${k}`); } catch { /* old engines */ } };
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

function imageReady(img: HTMLImageElement | null): Promise<void> {
  if (!img) return Promise.resolve();
  const decode = () => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve());
  if (img.complete && img.naturalWidth) return decode().then(() => undefined);
  return new Promise<void>((res) => {
    const done = () => res();
    img.addEventListener('load', () => decode().then(done), { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

/** performance.now() at which the CSS counter first SHOWS 100 (reads the running CSS animation) */
function hundredAt(count: HTMLElement | null): number {
  try {
    const a = count?.getAnimations?.().find((x) => (x as CSSAnimation).animationName === 'pl-count');
    if (a && a.effect) {
      const ct = a.effect.getComputedTiming();
      const at = Number(ct.delay ?? 0) + Number(ct.duration ?? 0) * HUNDRED_AT;
      return performance.now() + Math.max(0, at - Number(a.currentTime ?? 0));
    }
  } catch { /* fall through */ }
  return Math.max(performance.now(), 60 + 1200 * HUNDRED_AT);
}

export function initPreloader(): Promise<void> {
  trackTouch(); // from boot: a finger that is already down counts
  const html = document.documentElement;
  const el = document.querySelector<HTMLElement>('.preloader');
  const finish = () => {
    el?.remove();
    html.classList.remove('pl-on');
    if (phase !== 'done') { beats.length = 0; setPhase('done'); bus.emit('preloader:done'); }
    return Promise.resolve();
  };
  if (!el || !html.classList.contains('pl-on') || !env.motionAllowed()) return finish();
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return finish();

  el.classList.add('is-js'); // cancels the CSS failsafe
  setPhase('drawing');
  mark('init');
  if (window.scrollY > 0) window.scrollTo(0, 0);
  lockScroll();
  return new Promise<void>((resolve) => { run(el, resolve).catch(() => { cleanup(el); resolve(); }); });
}

let cleaned = false;
function cleanup(el: HTMLElement) {
  if (cleaned) return;
  cleaned = true;
  const hero = document.querySelector<HTMLElement>('.hero');
  hero?.classList.remove('hero--intro');
  hero?.style.removeProperty('--win-r'); hero?.style.removeProperty('--win-x'); hero?.style.removeProperty('--win-y');
  el.remove();
  mark('done');
  document.documentElement.classList.remove('pl-on');
  unlockScroll();
  session.set(KEY, '1');
  beats.length = 0;
  setPhase('done');
  bus.emit('preloader:done');
}

async function run(el: HTMLElement, resolve: () => void) {
  const count = el.querySelector<HTMLElement>('.preloader__count');
  const disc = el.querySelector<SVGSVGElement>('.preloader__disc');
  const meta = el.querySelector<HTMLElement>('.preloader__meta');
  const pith = el.querySelector<SVGCircleElement>('.pl-pith');
  const hero = document.querySelector<HTMLElement>('.hero');
  const img = document.querySelector<HTMLImageElement>('[data-hero-img]');

  let resolved = false;
  const go = () => { if (!resolved) { resolved = true; resolve(); } };

  // a tap / wheel / key press during the drawing skips straight to the opening — nobody waits for the intro
  // (and motion turning off ends it at once)
  let skip!: () => void;
  const skipped = new Promise<void>((r) => { skip = r; });
  const onSkip = () => skip();
  window.addEventListener('pointerdown', onSkip, { once: true, passive: true });
  window.addEventListener('wheel', onSkip, { once: true, passive: true });
  window.addEventListener('keydown', onSkip, { once: true });
  const offMotion = bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => { if (!allowed) { gsap.killTweensOf([hero, disc, meta]); cleanup(el); go(); } });

  const imgReady = imageReady(img);
  const t100 = hundredAt(count);
  try { performance.mark('of:preloader:shows100', { startTime: t100 }); } catch { /* old engines */ }
  const until = (t: number) => wait(t - performance.now());
  // ---- the beat: hooks start on the counter's last ticks (the rings are drawn, only digits change)
  await Promise.race([until(t100 - BEAT_LEAD), skipped]);
  if (cleaned) return;
  setPhase('beat');
  mark('beat');
  const hooks = beats.splice(0).map((fn) => { try { return Promise.resolve(fn()); } catch { return Promise.resolve(); } });
  const hooksDone = hooks.length ? Promise.race([Promise.allSettled(hooks), until(t100 + BEAT_CAP)]) : Promise.resolve();
  // ---- open the moment 100 shows — unless the photo (LCP) or a warm-up hook still needs a moment (capped)
  await Promise.race([
    Promise.all([until(t100), hooksDone, Promise.race([imgReady, until(t100 + IMG_CAP)])]),
    skipped.then(() => Promise.race([imgReady, wait(120)])),
  ]);
  window.removeEventListener('pointerdown', onSkip);
  window.removeEventListener('wheel', onSkip);
  window.removeEventListener('keydown', onSkip);
  if (cleaned || !hero || !disc) { offMotion(); cleanup(el); go(); return; }
  mark('100');
  // the counter shows 100 (and every ring is complete) even if we got here a tick early or skipped
  try {
    el.getAnimations?.({ subtree: true }).forEach((a) => { if ((a as CSSAnimation).animationName !== 'pl-turn') a.finish(); });
  } catch { /* old engines: the CSS keeps running, harmless */ }

  // ---- open the ring window -------------------------------------------------
  setPhase('opening');
  mark('open');
  el.classList.add('is-opening');
  const W = window.innerWidth;
  const heroH = hero.offsetHeight || window.innerHeight;
  const pr = pith?.getBoundingClientRect();
  const cx = pr ? pr.left + pr.width / 2 : W / 2;
  const cy = pr ? pr.top + pr.height / 2 : window.innerHeight / 2;
  const rMax = Math.hypot(Math.max(cx, W - cx), Math.max(cy, heroH - cy)) + 4;
  const db = disc.getBoundingClientRect();
  const barkPx = (db.width / 400) * 186;
  const S = (rMax * 1.14) / Math.max(40, barkPx);

  hero.style.setProperty('--win-x', `${cx}px`);
  hero.style.setProperty('--win-y', `${cy}px`);
  hero.style.setProperty('--win-r', '0px');
  hero.classList.add('hero--intro');

  const tl = gsap.timeline({ defaults: { ease: OPEN_EASE } });
  if (meta) tl.to(meta, { autoAlpha: 0, y: -10, duration: 0.3, ease: 'power2.in' }, 0);
  tl.to(disc, { scale: S, duration: OPEN }, 0);
  tl.to(hero, { '--win-r': `${rMax}px`, duration: OPEN }, 0.02);
  tl.to(disc.querySelectorAll('.pl-r:not(.pl-r--bark), .pl-pith'), { opacity: 0, duration: 0.42, ease: 'power1.in', stagger: { each: 0.016, from: 'start' } }, 0.06);
  tl.to(disc.querySelector('.pl-r--bark'), { opacity: 0.35, duration: 0.45, ease: 'power1.in' }, 0.3);
  tl.call(go, undefined, RESOLVE_AT);
  tl.call(() => { offMotion(); cleanup(el); }, undefined, OPEN + 0.02);
  // dev: ?plpause freezes the opening so it can be inspected frame by frame (window.__ofPreloaderTl.progress(x))
  if (import.meta.env.DEV && location.search.includes('plpause')) { tl.pause(); (window as any).__ofPreloaderTl = tl; }
}
