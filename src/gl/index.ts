/* ==========================================================================
   src/gl — public, lightweight entry (does NOT import three.js).
   three.js + the stage are loaded on demand with preloadGL() (a separate chunk), after the first frame.

   API
     preloadGL()                       start fetching the GL chunk (idempotent)
     mountHeroWind(opts)               the hero wind view → HeroWindHandle | null (null = keep the photo)
     enableRipples({ minTier })        hover ripple on every [data-gl="ripple"] image (delegated, so images
                                       added later work too). Desktop + fine pointer + motion + WebGL only.
                                       Put data-gl="ripple" on the <img> (via <img data-img=… data-gl="ripple">)
                                       or on a wrapper that contains exactly one image.
     disableRipples()                  remove the listeners and hand the canvas back
     disposeGL()                       tear everything down (motion turned off, page leave)
   All of it shares ONE WebGLRenderer / ONE canvas (src/gl/stage.ts).
   ========================================================================== */
import { env, gpuTier, hasWebGL, type Tier } from '../core/env';
import { bus } from '../core/bus';
import type { HeroWindHandle, HeroWindOptions, RippleHandle } from './types';

export type { HeroWindHandle, HeroWindOptions, GLQuality, RippleHandle } from './types';

type StageModule = typeof import('./stage');
// env.hasWebGL() creates a throwaway context on every call — ask once per page
let webgl: boolean | null = null;
const canGL = () => (webgl ??= hasWebGL());
/** WebGL available on this device (asked once per page) */
export const webglAvailable = canGL;
let modP: Promise<StageModule> | null = null;

export function preloadGL(): Promise<StageModule> {
  if (!modP) modP = import('./stage');
  return modP;
}

export async function mountHeroWind(o: HeroWindOptions): Promise<HeroWindHandle | null> {
  if (!env.motionAllowed() || !canGL()) return null;
  try {
    const m = await preloadGL();
    if (!env.motionAllowed()) return null;
    return await m.createHeroWind(o);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[gl] hero wind unavailable', e);
    return null;
  }
}

/* ---------------------------------------------------------------- ripples (delegated) */
let rippleOff: (() => void) | null = null;

export function enableRipples(opts: { minTier?: Tier } = {}): () => void {
  if (rippleOff) return disableRipples;
  if (env.isTouch || !env.motionAllowed() || !canGL()) return () => {};
  let tierOk: boolean | null = null;
  gpuTier().then((t) => { tierOk = t.tier >= (opts.minTier ?? 1); }).catch(() => { tierOk = false; });
  let el: Element | null = null;
  let handle: RippleHandle | null = null;
  let token = 0;

  const leave = () => { handle?.leave(); handle = null; el = null; token++; };
  const over = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (tierOk === false) return;
    const hit = (e.target as Element | null)?.closest?.('[data-gl="ripple"]') ?? null;
    if (hit === el) return;
    if (el) leave();
    if (!hit) return;
    const img = hit instanceof HTMLImageElement ? hit : hit.querySelector('img');
    if (!img) return;
    el = hit;
    const my = ++token;
    preloadGL().then((m) => m.rippleFor(img)).then((h) => {
      if (my !== token || !env.motionAllowed() || !h) return;
      handle = h;
      h.enter(e);
    }).catch(() => undefined);
  };
  const move = (e: PointerEvent) => { if (handle && el?.contains(e.target as Node)) handle.move(e); };
  const out = (e: PointerEvent) => { if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) leave(); };
  document.addEventListener('pointerover', over, { passive: true });
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', out, { passive: true });
  rippleOff = () => {
    document.removeEventListener('pointerover', over);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerout', out);
    leave();
    modP?.then((m) => m.releaseRipples()).catch(() => undefined);
    rippleOff = null;
  };
  return disableRipples;
}

export function disableRipples() { rippleOff?.(); }

export function disposeGL() {
  disableRipples();
  modP?.then((m) => m.disposeStage()).catch(() => undefined);
}

bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => { if (!allowed) disableRipples(); });

/* dev tool: window.__ofGLCapture({ w, h, fps, seconds, src, mask }) → PNG data URLs of a seamless wind loop */
if (import.meta.env.DEV) {
  (window as any).__ofGLCapture = (o: import('./capture').CaptureOptions) => import('./capture').then((m) => m.captureLoop(o));
}
