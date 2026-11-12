/* ==========================================================================
   Sound — "צלילי היער". CONTRACT (owned by the chrome agent; keep this API).
   Off by default; one toggle in the header; choice remembered (storage, try/catch).
   Everything quiet and soft. Must never throw and must no-op while off.

   This file is the small, always-loaded facade. The procedural WebAudio engine
   (ambient bed by the time of day in Israel, one-shot effects, a small procedural
   reverb — no audio files) lives in src/chrome/sound-engine.ts and is loaded lazily:
   at idle when sound was left on in an earlier visit, or on the click that turns it on.
   The AudioContext is created and resumed synchronously inside the user gesture
   (iOS autoplay policy), suspended while the tab is hidden and when sound is off.
   ========================================================================== */
import { storage } from './storage';
import { env } from './env';
import { bus } from './bus';

export type SoundName =
  | 'hover'      // soft wooden click on hover
  | 'click'      // UI click
  | 'rustle'     // leaves rustle (tree tap, menu)
  | 'water'      // short pour
  | 'absorb'     // water soaking into soil
  | 'crack'      // seed cracking (dry, quiet)
  | 'paper'      // paper rustle (herbarium, certificate)
  | 'sparkle'    // engraving sparks / glowing leaf
  | 'chime'      // success / tree born
  | 'pop'        // sprout pops out (footer, contact)
  | 'whoosh'     // page transition
  | 'bird';      // single bird call
export type Ambient = 'forest' | 'morning' | 'day' | 'evening' | 'night' | 'rain' | 'memorial' | null;
export interface LoopHandle { setVolume(v: number): void; stop(fadeSec?: number): void }

type Engine = typeof import('../chrome/sound-engine');

const KEY = 'sound:on';
let on = storage.get<boolean>(KEY, false) === true;
let ctx: AudioContext | null = null;
let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;
/** page override; undefined = automatic by time of day */
let ambientRequest: Ambient | undefined;
const safe = (fn: () => void) => { try { fn(); } catch { /* sound must never throw */ } };
const NOOP: LoopHandle = { setVolume() {}, stop() {} };

function load(): Promise<Engine | null> {
  if (!loading) {
    loading = import('../chrome/sound-engine')
      .then((m) => { engine = m; m.attach({ isOn: () => on, ambient: () => ambientRequest }); return m; })
      .catch(() => { loading = null; return null; });
  }
  return loading;
}

/** create + resume the context synchronously (must run inside a user gesture on iOS) */
function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    // iOS: respect the silent switch (polite, ambient category)
    try { const s = (navigator as any).audioSession; if (s) s.type = 'ambient'; } catch { /* ignore */ }
    ctx = new AC({ latencyHint: 'interactive' });
  } catch { ctx = null; }
  return ctx;
}

function start() {
  const c = context(); if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => { /* needs a gesture */ });
  load().then((m) => { if (m && on) m.start(c); });
}

/* unlock on the first user gesture (iOS/Chrome autoplay policy) */
const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
function onGesture() {
  if (!on) return;
  safe(start);
  if (ctx?.state === 'running' && engine) GESTURES.forEach((e) => window.removeEventListener(e, onGesture, true));
}
if (typeof window !== 'undefined') {
  GESTURES.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }));
  // sound was left on: have the engine ready before the first gesture, without touching the first paint
  if (on) {
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    const warm = () => { load(); };
    if (document.readyState === 'complete') (idle ? idle(warm, { timeout: 3000 }) : setTimeout(warm, 1200));
    else window.addEventListener('load', () => (idle ? idle(warm, { timeout: 3000 }) : setTimeout(warm, 1200)), { once: true });
  }
  // bfcache restore: the context may be suspended
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted && on && ctx) safe(start); });
}

/* ------------------------------------------------------------------ API */
export const sound = {
  isOn(): boolean { return on; },
  setOn(next: boolean): void {
    safe(() => {
      next = !!next;
      if (next === on) { if (next) start(); return; }
      on = next;
      storage.set(KEY, on);
      if (on) start(); else if (engine) engine.stop(); else ctx?.suspend().catch(() => {});
      bus.emit('sound:change', { on });
    });
  },
  toggle(): boolean { sound.setOn(!on); return on; },
  /** must be called from a user gesture before audio can start (iOS) */
  unlock(): void { safe(() => { if (on) start(); }); },
  play(name: SoundName, opts: { volume?: number; rate?: number } = {}): void {
    if (!on || !engine) return;
    safe(() => engine!.engine.play(name, opts));
  },
  /** continuous sound (e.g. pouring water while holding) */
  loop(name: 'water' | 'wind', opts: { volume?: number } = {}): LoopHandle {
    if (!on || !engine) return NOOP;
    try { return engine.engine.loop(name, opts); } catch { return NOOP; }
  },
  /** background bed by time of day / weather */
  setAmbient(kind: Ambient): void { safe(() => { ambientRequest = kind; engine?.setAmbient(); }); },
  /** short vibration on Android (navigator.vibrate) — respects motion + sound-independent */
  haptic(pattern: number | number[] = 12): void {
    safe(() => { if (env.isAndroid && typeof navigator.vibrate === 'function' && env.motionAllowed()) navigator.vibrate(pattern); });
  },
};
