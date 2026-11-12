/* ==========================================================================
   The home WebGL stage — ONE three.js renderer, ONE canvas, several "views".
   The canvas is not a fixed full-screen layer: it is moved into the element of whichever view needs frames
   (the hero photo, or the image under the cursor), so it inherits that element's transforms, leaf clip,
   border-radius and stacking — no DOM↔GL position syncing, no z-order fights with text over images.
   · priority: a hovered ripple image (2) > the hero (1)
   · RAF runs only while a view is alive (on screen / hovered / decaying) and the tab is visible
   · DPR is capped per view (≤ 2 always)
   · context loss → everything falls back to the <img> underneath (the canvas is simply removed)
   This module imports three.js — load it with `import('./stage')` (see src/gl/index.ts), never statically.
   ========================================================================== */
import { WebGLRenderer } from 'three';

export interface View {
  /** element the canvas is placed into */
  readonly host: HTMLElement;
  readonly priority: number;
  /** transient views (ripples) give the canvas back as soon as they stop; the hero keeps it */
  readonly transient: boolean;
  alive(): boolean;
  attach(canvas: HTMLCanvasElement): void;
  detach?(): void;
  size(): { w: number; h: number };
  dpr(): number;
  frame(renderer: WebGLRenderer, dt: number, now: number): void;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private views = new Set<View>();
  private current: View | null = null;
  private raf = 0;
  private last = 0;
  private dirty = true;
  private lost = false;
  private ro: ResizeObserver;
  private sizeKey = '';

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.className = 'gl-stage';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas, antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default',
    });
    this.renderer.setClearColor(0x232e1c, 1);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf); this.raf = 0;
      canvas.remove();
      this.current = null;
    });
    this.ro = new ResizeObserver(() => { this.dirty = true; this.wake(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.sleep(); else { this.last = 0; this.wake(); } });
    window.addEventListener('resize', () => { this.dirty = true; this.wake(); }, { passive: true });
  }

  get isLost() { return this.lost; }

  add(v: View) { this.views.add(v); this.wake(); }
  remove(v: View) {
    this.views.delete(v);
    if (this.current === v) this.release();
    this.wake();
  }

  /** start the frame loop if anything wants frames */
  wake() {
    if (this.raf || this.lost || document.hidden) return;
    this.raf = requestAnimationFrame(this.tick);
  }
  private sleep() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** render one frame right now (e.g. before a reveal) */
  renderNow(v: View) {
    if (this.lost) return;
    if (this.current !== v) this.place(v);
    if (this.dirty) this.resize();
    v.frame(this.renderer, 0, performance.now() / 1000);
  }

  private pick(): View | null {
    let best: View | null = null;
    for (const v of this.views) if (v.alive() && (!best || v.priority > best.priority)) best = v;
    return best;
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.lost) return;
    const v = this.pick();
    if (!v) {
      if (this.current?.transient) this.release();
      this.last = 0;
      return; // sleep until a view wakes us
    }
    if (v !== this.current) this.place(v);
    if (this.dirty) this.resize();
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    v.frame(this.renderer, dt, now / 1000);
    this.raf = requestAnimationFrame(this.tick);
  };

  private place(v: View) {
    if (this.current) { this.ro.unobserve(this.current.host); this.current.detach?.(); }
    this.current = v;
    v.attach(this.canvas);
    this.ro.observe(v.host);
    this.dirty = true;
  }
  private release() {
    if (!this.current) return;
    this.ro.unobserve(this.current.host);
    this.current.detach?.();
    this.current = null;
    this.canvas.remove();
  }
  private resize() {
    this.dirty = false;
    const v = this.current; if (!v) return;
    const { w, h } = v.size();
    const pr = v.dpr();
    const key = `${w}x${h}@${pr}`;
    if (key === this.sizeKey || w < 2 || h < 2) return;
    this.sizeKey = key;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    this.sleep();
    this.release();
    this.views.clear();
    this.ro.disconnect();
    this.renderer.dispose();
  }
}

let stage: Stage | null = null;
export function getStage(): Stage {
  if (!stage || stage.isLost) stage = new Stage();
  return stage;
}
export function disposeStage() { stage?.dispose(); stage = null; }

export { createHeroWind } from './hero-wind';
export { rippleFor, releaseRipples } from './ripple';
