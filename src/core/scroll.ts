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
