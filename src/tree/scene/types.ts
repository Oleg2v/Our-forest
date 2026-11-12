/* Internal contracts between the scene driver (index.ts) and the two renderers. */
import type { TreeSceneState } from '../scene-api';
import type { Projector } from './camera';
import type { Look } from './look';
import type { GrowResult, TreeModel, SeasonLook } from './model';
import type { RGB } from './util';

/** live animation values (tweened by sequences, read by renderers every frame) */
export interface Anim {
  breathe: number;      // tree scale multiplier (visit intro 1 → 1.02 → 1)
  fog: number;          // intro fog 0..1
  appear: number;       // island opacity 0..1
  plaqueRise: number;   // 0 hidden in the soil … 1 standing
  plaqueGlow: number;   // memorial warm glow at the plaque 0..1
  seed: number;         // seed visible 0..1 (before planting / birth)
  seedPulse: number;    // 0..1
  crack: number;        // 0..3 cracks
  spot: number;         // watering: dark spot radius 0..1
  seep: number;         // seep through the strata 0..1
  wet: number;          // wet soil 0..1 (soilMoisture, rain, after watering)
  rootGlow: number;     // glow front tip → trunk 0..1
  rootGlowA: number;    // glow opacity 0..1
  lift: number;         // leaves lift 0..1 (→ 4°)
  glisten: number;      // droplets 0..1
  ghost: number;        // dashed adult silhouette 0..1
  sibling: number;      // dashed --fruit spot 0..1
  news: number;         // news dot 0..1
  prune: number;        // fresh cuts 0..1
  wind: number;         // effective wind 0..1
  shake: number;        // current shake offset (signed, decaying)
  fruitSwing: number;   // index of the swinging fruit (-1 none)
  fruitSwingA: number;  // swing amplitude
  greetPulse: number;   // index of a pulsing greeting leaf (-1)
  greetPulseA: number;
  birthClose: number;   // 1 = camera on the seed … 0 = normal framing
  closeY: number;       // close-up target height
}

export interface FallingLeaf {
  x: number; y: number; z: number;        // island space
  vx: number; vy: number; vz: number;
  rot: number; spin: number; tilt: number; phase: number;
  size: number;
  color: RGB;
  life: number;      // seconds alive
  landed: number;    // seconds since landing (-1 = falling)
  alpha: number;
  petal: boolean;
}

export interface Frame {
  time: number;          // seconds, animation clock (memorial: slower)
  dt: number;
  state: TreeSceneState;
  look: Look;
  season: SeasonLook;
  proj: Projector;
  model: TreeModel;
  grow: GrowResult;
  a: Anim;
  falling: FallingLeaf[];
  motion: boolean;
  quality: number;
  w: number; h: number; dpr: number;
  plaque: { canvas: HTMLCanvasElement; version: number };
  token: HTMLCanvasElement;
  /** greeting leaf index → leaf index in the model (current growth) */
  greetLeaves: number[];
  /** monotonically increasing when anything that changes static SVG geometry changes */
  sceneKey: string;
}

export interface Renderer {
  readonly kind: 'webgl' | 'svg';
  readonly el: Element;
  /** draw the first frame; resolves when it is on screen */
  init(f: Frame): Promise<void>;
  setModel(model: TreeModel): void;
  render(f: Frame): void;
  resize(w: number, h: number, dpr: number): void;
  setQuality?(q: number): void;
  /** render the scene layer (transparent background) at w×h with the current projection */
  snapshot(f: Frame, w: number, h: number): Promise<HTMLCanvasElement | null>;
  dispose(): void;
}
