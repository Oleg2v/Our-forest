/* Environment: input type, viewport, reduced motion (system OR a11y panel), GPU tier. */
import { getGPUTier } from 'detect-gpu';
import { bus } from './bus';
import { storage } from './storage';

const mq = (q: string) => (typeof window !== 'undefined' ? window.matchMedia(q) : ({ matches: false } as MediaQueryList));
const reduceMQ = mq('(prefers-reduced-motion: reduce)');
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const env = {
  /** touch-first device (no hover / coarse pointer) — no custom cursor, no magnetic buttons, native scroll */
  isTouch: mq('(hover: none), (pointer: coarse)').matches,
  isIOS: /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document),
  isAndroid: /Android/i.test(ua),
  /** phone layout breakpoint (designed separately, not shrunk) */
  isMobile: () => mq('(max-width: 768px)').matches,
  saveData: !!(navigator as any)?.connection?.saveData,
  /** system reduced-motion */
  systemReducedMotion: () => reduceMQ.matches,
  /** a11y panel "stop animations" */
  userMotionOff: () => storage.get<boolean>('a11y:motionOff', false),
  /** single source of truth: animate only if this is true */
  motionAllowed: () => !reduceMQ.matches && !storage.get<boolean>('a11y:motionOff', false),
};

/** Sync <html> classes: .motion / .no-motion, .touch / .no-touch */
export function syncEnvClasses() {
  const h = document.documentElement;
  h.classList.toggle('motion', env.motionAllowed());
  h.classList.toggle('no-motion', !env.motionAllowed());
  h.classList.toggle('touch', env.isTouch);
  h.classList.toggle('no-touch', !env.isTouch);
  if (env.userMotionOff()) h.dataset.a11yMotion = 'off'; else delete h.dataset.a11yMotion;
}

/** Call when the a11y panel toggles animations. Emits 'motion:change'. */
export function setUserMotionOff(off: boolean) {
  storage.set('a11y:motionOff', off);
  syncEnvClasses();
  bus.emit('motion:change', { allowed: env.motionAllowed() });
}
reduceMQ.addEventListener?.('change', () => { syncEnvClasses(); bus.emit('motion:change', { allowed: env.motionAllowed() }); });

export type Tier = 0 | 1 | 2 | 3;
let tierPromise: Promise<{ tier: Tier; isMobile: boolean; gpu?: string }> | null = null;
/**
 * GPU tier via detect-gpu (benchmarks self-hosted in /detect-gpu).
 * 0 = no WebGL / blocklisted → use photo/SVG fallbacks
 * 1 = weak → lightest effects (or fallback on phones)
 * 2 = mid, 3 = strong → full effects (DPR ≤ 2 always)
 */
export function gpuTier() {
  if (tierPromise) return tierPromise;
  tierPromise = (async () => {
    if (!env.motionAllowed()) return { tier: 0 as Tier, isMobile: env.isMobile() };
    try {
      const r = await Promise.race([
        getGPUTier({ benchmarksURL: '/detect-gpu' }),
        new Promise<null>((res) => setTimeout(() => res(null), 2500)),
      ]);
      if (!r) return { tier: (env.isTouch ? 1 : 2) as Tier, isMobile: env.isTouch };
      let tier = r.tier as Tier;
      // software renderers (headless/SwiftShader) report tier 0/1 — still allow a light experience on desktop
      if (r.type === 'FALLBACK') tier = 1;
      return { tier, isMobile: !!r.isMobile, gpu: r.gpu };
    } catch {
      return { tier: 1 as Tier, isMobile: env.isTouch };
    }
  })();
  return tierPromise;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
