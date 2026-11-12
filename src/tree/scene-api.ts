/* ==========================================================================
   Living tree scene — CONTRACT between the two /tree agents.
   • "tree-scene" agent implements createTreeScene() in src/tree/scene/** (Three.js
     "living botanical engraving" + an SVG fallback with the same API/actions).
   • "tree-ui" agent builds the page (src/pages/tree.ts, src/tree/ui/**) against this API:
     derives TreeSceneState from tree.json + Israel time + demo weather switch, drives the
     birth sequence, the watering ritual (2D can + water-arc particle overlay is UI-side),
     timeline, herbarium, greetings, share, memorial mode, PWA.
   Change this file only by agreement (append-only additions are OK).
   ========================================================================== */
import type { SpeciesId } from '../components/forest-map';
import type { Season } from '../core/format';

export type Weather = 'clear' | 'wind' | 'rain' | 'hamsin';
export type HotspotKind = 'trunk' | 'plaque' | 'fruit' | 'leaf' | 'greeting' | 'ground' | 'qr';
export type BirthPhase = 'soil' | 'crack' | 'sprout' | 'reveal' | 'done';

export interface GreetingLeaf { id: string; initials: string; glowing: boolean }

export interface TreeSceneState {
  id: string;                 // "0427"
  seed: number;               // 427 — deterministic shape (space colonization / generator)
  species: SpeciesId;
  mode: 'celebration' | 'memorial';
  dedication: string;         // plaque text (same wood texture + font as the configurator)
  hours: number;              // Israel local time 0..24 → dawn pink + birds, day warm, sunset long shadows, night moon + fireflies
  season: Season;             // deciduous (fig, pomegranate, almond, mulberry) yellow & drop in autumn, bare in winter; olive & carob evergreen; almond blooms late winter
  weather: Weather;           // wind sways branches by strength, rain drops + dark soil, hamsin warm haze
  windStrength: number;       // 0..1
  ageDays: number;            // days since planting (<0 = before planting). Timeline scrubs this smoothly.
  futureGhost: boolean;       // show dashed silhouette of the adult tree (timeline in the future)
  soilMoisture: number;       // 0..1 — wet dark soil after team/user watering
  freshPrune: boolean;        // fresh cuts after pruning
  harvestReady: boolean;      // fruits on branches (team mark "ripe")
  planted: boolean;           // false → a seed lies in the soil cut (UI shows countdown)
  greetings: GreetingLeaf[];  // glowing leaves with initials on the crown
  hasNews: boolean;           // soft blinking dot above the crown
  quality: 0 | 1 | 2 | 3;     // device tier (leaves 3–5k desktop / 1–2k phone via instancing; hatching+shadows only on strong)
  /** (added by tree-scene, optional) 7.11 "עץ אח": the sibling tree's spot on the island, dashed --fruit */
  siblingSpot?: boolean;
  /** (added, optional) 7.8 the age the dashed future silhouette shows (the timeline's future tail); default: adult */
  ghostAgeDays?: number;
}

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  x: number; y: number;       // CSS px relative to the scene container
  visible: boolean;
  label: string;              // Hebrew accessible label
}

export interface TreeScene {
  readonly kind: 'webgl' | 'svg';
  /** resolves after the first frame is on screen (the static SVG of the same tree is shown first for LCP).
   *  (added) `birth: true` — the first frame is already the birth's opening pose (empty paper → soil close-up),
   *  not the grown tree; WebGL waits until the birth is over so the sequence never stutters. */
  mount(container: HTMLElement, opts?: { birth?: boolean }): Promise<void>;
  setState(patch: Partial<TreeSceneState>): void;
  getState(): TreeSceneState;

  /** First opening, 7.5 s: 0–1.2 soil + pulsing seed; 1.2–2.4 three cracks + dry click; 2.4–4.0 root down & branches,
   *  sprout up, first two leaves spring open; 4.0–6.0 camera pulls back, island visible, plaque rises, engraving finishes
   *  burning on the last letter; 6.0–7.5 caption (UI). Skippable. */
  playBirth(opts?: { onPhase?: (p: BirthPhase) => void; signal?: AbortSignal }): Promise<void>;
  skipBirth(): void;
  /** regular visit: island appears out of light fog (0.9 s), tree "breathes" (scale 1 → 1.02 → 1) */
  playVisitIntro(): Promise<void>;

  /** watering — the UI owns the button ring, the tilted can and the 2D water-arc particles */
  waterStart(): void;                  // dark spot spreads from the centre of the soil
  waterProgress(p: number): void;      // 0..1 while holding
  waterEnd(counted: boolean): Promise<void>; // seep through soil layers 1.2 s, roots light tip→trunk 0.8 s, leaves lift 3–5°, droplets glisten 4 s; ~1 in 3 a bird lands for 2 s

  shake(): void;                       // tap trunk: shake + 3–6 leaves fall (more in autumn) + rustle
  focus(target: 'plaque' | 'crown' | 'reset'): Promise<void>; // 0.9 s power3.inOut
  rotateBy(deg: number): void;         // keyboard arrows; island rotation clamped to ±25° with spring
  /** screen-space hotspots so the UI can render focusable proxies (Tab order: plaque, fruits, leaves) */
  getHotspots(): Hotspot[];
  on(ev: 'hotspot', cb: (h: Hotspot) => void): () => void;           // taps; long-press on ground → kind 'ground'
  on(ev: 'hotspots-change', cb: (list: Hotspot[]) => void): () => void;
  /** snapshot of the current view for share images (9:16 and 1:1) */
  snapshot(width: number, height: number): Promise<HTMLCanvasElement>;
  setPaused(paused: boolean): void;    // pause rendering when tab hidden / offscreen
  dispose(): void;
  /** (added, optional) the same visible answer as a tap on that hotspot, for the keyboard / DOM proxies:
   *  fruit swings, greeting leaf pulses, trunk shakes, crown rustles, ground → roots glow, plaque → focus. */
  poke?(id: string): void;
  /** (added, optional) what is under a point (CSS px in the container), null = empty paper around the island */
  hitTest?(x: number, y: number): HotspotKind | null;
}
