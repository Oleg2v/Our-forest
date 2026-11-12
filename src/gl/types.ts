import type { Season } from '../core/format';

export type GLQuality = 'full' | 'light';

export interface HeroWindOptions {
  /** element the canvas is placed into (absolute, inset 0) — the photo's wrapper */
  host: HTMLElement;
  /** the displayed photo (its currentSrc becomes the texture — no second download) */
  img: HTMLImageElement;
  /** foliage mask matching img's crop: /img/hero-mask.png or /img/hero-mask-portrait.png */
  maskUrl: string;
  season: Season;
  quality: GLQuality;
  /** device-pixel-ratio cap (≤ 2) */
  dprCap: number;
  /** seasonal particles (default true) */
  particles?: boolean;
  /** called once after the first frame is on the canvas */
  onFirstFrame?: () => void;
}

export interface HeroWindHandle {
  readonly canvas: HTMLCanvasElement;
  /** feed pointer positions (client px) — the cursor works as a gust of wind */
  pointer(x: number, y: number): void;
  /** touch: a short gust at a point */
  puff(x: number, y: number): void;
  /** the wind arrives (amplitude ramps 0 → 1 with an opening gust) */
  arrive(delay?: number): void;
  /** wind amplitude → 0 (smoothly) */
  calm(): void;
  /** hero on/off screen — the stage pauses when nothing visible needs frames */
  setVisible(v: boolean): void;
  /** device tilt, -1..1 per axis (particles parallax by depth) */
  setTilt(x: number, y: number): void;
  destroy(): void;
  /** dev: loop mode + render at time t (video capture) */
  __loop(period: number): void;
  __renderAt(t: number): void;
}

export interface RippleHandle {
  enter(e: PointerEvent): void;
  move(e: PointerEvent): void;
  leave(): void;
}
