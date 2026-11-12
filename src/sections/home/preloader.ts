/* ==========================================================================
   Home 0 — preloader "טבעות שנים" (tree rings).
   The rings and the 0→100 counter start at first paint from inline CSS (partials/home/preloader.html),
   independent of this bundle. This module decides WHEN the ring window opens:
     counter at 100  +  hero photo decoded (capped)  +  "beat" hooks (e.g. WebGL warm-up, capped)
   then the rings expand and the hero opens through a circular window (clip-path: circle) centred on the
   pith. The returned promise resolves mid-opening — the moment the hero entrance should start.
   ≤ 2.2 s in total. Skipped (resolves at once) on a repeat visit in this session, after an in-site page
   transition, on deep links, and with reduced motion. Emits bus 'preloader:done' when the layer is gone.
   ========================================================================== */
import './preloader.css';
import { gsap } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { session } from '../../core/storage';
import { lockScroll, unlockScroll } from '../../core/scroll';

const KEY = 'preloader';
const OPEN = 0.9;           // window opening (s)
const RESOLVE_AT = 0.36;    // hero entrance starts this far into the opening (s)

type Beat = () => unknown;
const beats: Beat[] = [];
let state: 'idle' | 'playing' | 'done' = 'idle';

/** Run fn at the "beat" (counter reached 100, right before the window opens). Ignored once done. */
export function onPreloaderBeat(fn: Beat) { if (state !== 'done') beats.push(fn); }
/** true while the ring layer covers the page */
export function preloaderPlaying() { return state === 'playing'; }

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

/** ms until the CSS counter reaches 100 (reads the running CSS animation) */
function msToHundred(count: HTMLElement | null): number {
  try {
    const a = count?.getAnimations?.().find((x) => (x as CSSAnimation).animationName === 'pl-count');
    if (a && a.effect) {
      const end = Number(a.effect.getComputedTiming().endTime ?? 0);
      const now = Number(a.currentTime ?? 0);
      return Math.max(0, end - now);
    }
  } catch { /* fall through */ }
  return Math.max(0, 1360 - performance.now());
}

export function initPreloader(): Promise<void> {
  const html = document.documentElement;
  const el = document.querySelector<HTMLElement>('.preloader');
  const finish = () => {
    el?.remove();
    html.classList.remove('pl-on');
    if (state !== 'done') { state = 'done'; beats.length = 0; bus.emit('preloader:done'); }
    return Promise.resolve();
  };
  if (!el || !html.classList.contains('pl-on') || !env.motionAllowed()) return finish();
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return finish();

  el.classList.add('is-js'); // cancels the CSS failsafe
  state = 'playing';
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
  document.documentElement.classList.remove('pl-on');
  unlockScroll();
  session.set(KEY, '1');
  state = 'done';
  beats.length = 0;
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
  await Promise.race([wait(msToHundred(count)), skipped]);
  if (cleaned) return;
  // the counter shows 100 even if we skipped early
  try {
    el.getAnimations?.({ subtree: true }).forEach((a) => { if ((a as CSSAnimation).animationName !== 'pl-turn') a.finish(); });
  } catch { /* old engines: the CSS keeps running, harmless */ }
  void count;
  // the hero photo is the LCP — give it a moment, never more than ~0.4 s
  await Promise.race([imgReady, wait(420), skipped.then(() => wait(120))]);
  // beat: warm-up hooks (WebGL compile + texture upload hide here, behind a still frame)
  const hooks = beats.splice(0).map((fn) => { try { return Promise.resolve(fn()); } catch { return Promise.resolve(); } });
  if (hooks.length) await Promise.race([Promise.allSettled(hooks), wait(140)]);
  window.removeEventListener('pointerdown', onSkip);
  window.removeEventListener('wheel', onSkip);
  window.removeEventListener('keydown', onSkip);
  if (cleaned || !hero || !disc) { offMotion(); cleanup(el); go(); return; }

  // ---- open the ring window -------------------------------------------------
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

  const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
  if (meta) tl.to(meta, { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in' }, 0);
  tl.to(disc, { scale: S, duration: OPEN }, 0);
  tl.to(hero, { '--win-r': `${rMax}px`, duration: OPEN }, 0.04);
  tl.to(disc.querySelectorAll('.pl-r:not(.pl-r--bark), .pl-pith'), { opacity: 0, duration: 0.5, ease: 'power1.in', stagger: { each: 0.02, from: 'start' } }, 0.12);
  tl.to(disc.querySelector('.pl-r--bark'), { opacity: 0.35, duration: 0.5, ease: 'power1.in' }, 0.4);
  tl.call(go, undefined, RESOLVE_AT);
  tl.call(() => { offMotion(); cleanup(el); }, undefined, OPEN + 0.06);
  // dev: ?plpause freezes the opening so it can be inspected frame by frame (window.__ofPreloaderTl.progress(x))
  if (import.meta.env.DEV && location.search.includes('plpause')) { tl.pause(); (window as any).__ofPreloaderTl = tl; }
}
