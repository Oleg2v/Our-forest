/* ==========================================================================
   Sound — "צלילי היער". CONTRACT (owned by the chrome agent; keep this API).
   Off by default; one toggle in the header; choice remembered (storage, try/catch).
   Everything quiet and soft. Must never throw and must no-op while off.
   STUB: no-op implementation until the chrome agent implements it.
   ========================================================================== */
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

export const sound = {
  isOn(): boolean { return false; },
  setOn(_on: boolean): void {},
  toggle(): boolean { return false; },
  /** must be called from a user gesture before audio can start (iOS) */
  unlock(): void {},
  play(_name: SoundName, _opts: { volume?: number; rate?: number } = {}): void {},
  /** continuous sound (e.g. pouring water while holding) */
  loop(_name: 'water' | 'wind', _opts: { volume?: number } = {}): LoopHandle { return { setVolume() {}, stop() {} }; },
  /** background bed by time of day / weather */
  setAmbient(_kind: Ambient): void {},
  /** short vibration on Android (navigator.vibrate) — respects motion + sound-independent */
  haptic(_pattern: number | number[] = 12): void {},
};
