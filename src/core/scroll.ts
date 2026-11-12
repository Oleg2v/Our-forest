/* Smooth scroll: Lenis (lerp ≈ 0.1) synced to the GSAP ticker on desktop.
   Touch devices keep native scrolling. Disabled when motion is off. */
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';
import { env } from './env';
import { bus } from './bus';

let lenis: Lenis | null = null;
let locks = 0;
const raf = (time: number) => lenis?.raf(time * 1000);

function create() {
  if (lenis || env.isTouch || !env.motionAllowed()) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
}
function destroy() {
  if (!lenis) return;
  gsap.ticker.remove(raf);
  lenis.destroy();
  lenis = null;
}

export function initScroll() {
  create();
  bus.on('motion:change', ({ allowed }: { allowed: boolean }) => (allowed ? create() : destroy()));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
}

export function getLenis() { return lenis; }

/* ---- touch-scroll quiet ----------------------------------------------------------------------------------
   Phones: heavy one-off work (ScrollTrigger.refresh, page-wide style changes) never runs under the finger or
   during momentum — a long task mid-swipe is a dropped frame the visitor feels; 200 ms later it is not.
   (Same rule as the home sections' whenScrollQuiet in src/sections/home/preloader.ts.) */
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
/** a finger is down — unless nothing has moved for 3 s (a lost touchend must never hold work forever) */
const fingerDown = () => touches > 0 && performance.now() - Math.max(lastTouchAt, lastScrollAt) < 3000;
/** no finger on the screen and no scroll (momentum included) for `gap` ms */
export function scrollQuiet(gap = 180): boolean {
  trackTouch();
  return !fingerDown() && performance.now() - lastScrollAt >= gap;
}
type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
/** Runs fn at the next scroll-quiet moment, in idle time where the browser offers it. */
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

/** Scroll to an element / selector / y. Respects header height and reduced motion. */
export function scrollTo(target: string | HTMLElement | number, opts: { offset?: number; immediate?: boolean } = {}) {
  const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  const offset = opts.offset ?? -headerH * 0.5;
  const immediate = opts.immediate || !env.motionAllowed();
  if (lenis) { lenis.scrollTo(target as any, { offset, immediate, duration: 1.2 }); return; }
  let y: number;
  if (typeof target === 'number') y = target;
  else {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    if (!el) return;
    y = el.getBoundingClientRect().top + window.scrollY + offset;
  }
  window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
}

/** Lock page scroll for menus / sheets / dialogs (ref-counted). */
export function lockScroll() {
  if (locks++ === 0) {
    lenis?.stop();
    document.documentElement.style.overflow = 'hidden';
  }
}
export function unlockScroll() {
  if (locks === 0) return;
  if (--locks === 0) {
    lenis?.start();
    document.documentElement.style.overflow = '';
  }
}
