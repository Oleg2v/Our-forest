/* Forest map camera: own pan/zoom on GSAP (no d3-zoom).
   screen = (x, y) + k · L(world), where L rotates the plan 90° on portrait viewports
   (a tall phone sees the plot "standing up", so it fills the screen instead of a thin band). */
import { gsap } from '../../core/gsap';
import type { Pt } from './plan';

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface CamState { k: number; x: number; y: number }

export class Camera {
  k = 1; x = 0; y = 0;
  w = 1; h = 1;
  rot: 0 | 90 = 0;
  kMin = 0.1; kMax = 4; kFit = 1;
  /** the camera centre must stay inside this world rect */
  limit: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private tw: gsap.core.Tween | null = null;
  private proxy = { k: 1, x: 0, y: 0 };

  constructor(private onChange: () => void, private motion: () => boolean) {}

  /** world → rotated layout space */
  L(p: Pt): Pt { return this.rot ? [-p[1], p[0]] : [p[0], p[1]]; }
  /** layout → world */
  W(u: number, v: number): Pt { return this.rot ? [v, -u] : [u, v]; }
  toScreen(p: Pt, s: CamState = this): Pt { const [u, v] = this.L(p); return [s.x + s.k * u, s.y + s.k * v]; }
  toWorld(sx: number, sy: number): Pt { return this.W((sx - this.x) / this.k, (sy - this.y) / this.k); }
  layoutRect(r: Rect): Rect {
    const a = this.L([r.x0, r.y0]), b = this.L([r.x1, r.y1]);
    return { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
  }

  /** camera that shows world rect r inside the viewport with padding (px) */
  fitState(r: Rect, pad = 16, kCap = Infinity): CamState {
    const l = this.layoutRect(r);
    const bw = l.x1 - l.x0, bh = l.y1 - l.y0;
    const k = Math.min(kCap, Math.max(0.01, Math.min((this.w - pad * 2) / bw, (this.h - pad * 2) / bh)));
    return { k, x: this.w / 2 - k * (l.x0 + bw / 2), y: this.h / 2 - k * (l.y0 + bh / 2) };
  }
  /** camera with world point p at screen point (sx, sy) and zoom k */
  centerState(p: Pt, k: number, sx = this.w / 2, sy = this.h / 2): CamState {
    const [u, v] = this.L(p);
    return { k, x: sx - k * u, y: sy - k * v };
  }

  clamp(s: CamState): CamState {
    const k = Math.min(this.kMax, Math.max(this.kMin, s.k));
    // keep the zoom anchored around the viewport centre if k was clamped
    let x = s.x, y = s.y;
    if (k !== s.k) {
      const cx = this.w / 2, cy = this.h / 2;
      x = cx - ((cx - s.x) / s.k) * k;
      y = cy - ((cy - s.y) / s.k) * k;
    }
    // keep the plot covering the viewport, with a little slack (more when it is smaller than the view)
    const l = this.layoutRect(this.limit);
    const fit = (lo: number, hi: number, size: number, pos: number) => {
      const span = k * (hi - lo);
      const slack = Math.max(0, size - span) / 2 + size * 0.18;
      return Math.min(-k * lo + slack, Math.max(size - k * hi - slack, pos));
    };
    x = fit(l.x0, l.x1, this.w, x);
    y = fit(l.y0, l.y1, this.h, y);
    return { k, x, y };
  }

  get state(): CamState { return { k: this.k, x: this.x, y: this.y }; }
  get busy(): boolean { return !!this.tw?.isActive(); }

  set(s: CamState, clamp = true) {
    const c = clamp ? this.clamp(s) : s;
    this.k = c.k; this.x = c.x; this.y = c.y;
    this.onChange();
  }
  stop() { this.tw?.kill(); this.tw = null; }

  /** animated move (instant with reduced motion) */
  to(s: CamState, dur = 0.9, ease = 'power3.inOut'): Promise<void> {
    this.stop();
    const target = this.clamp(s);
    if (!this.motion() || dur <= 0) { this.set(target, false); return Promise.resolve(); }
    // interpolate in "zoom space" so a big zoom change feels even (log k), and keep the
    // world point under the viewport centre on a straight line
    const from = this.state;
    const cw = this.toWorld(this.w / 2, this.h / 2);
    const tw0 = { k: target.k, x: target.x, y: target.y };
    const twc = this.W((this.w / 2 - tw0.x) / tw0.k, (this.h / 2 - tw0.y) / tw0.k);
    const p = this.proxy; p.k = 0;
    return new Promise((resolve) => {
      this.tw = gsap.to(p, {
        k: 1, duration: dur, ease,
        onUpdate: () => {
          const t = p.k;
          const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * t);
          const c: Pt = [cw[0] + (twc[0] - cw[0]) * t, cw[1] + (twc[1] - cw[1]) * t];
          const s = this.centerState(c, k);
          this.k = s.k; this.x = s.x; this.y = s.y;
          this.onChange();
        },
        onComplete: () => { this.tw = null; this.set(target, false); resolve(); },
        onInterrupt: () => resolve(),
      });
    });
  }

  /** zoom by factor keeping screen point (sx, sy) fixed */
  zoomAt(f: number, sx: number, sy: number) {
    const k = Math.min(this.kMax, Math.max(this.kMin, this.k * f));
    const r = k / this.k;
    this.set({ k, x: sx - (sx - this.x) * r, y: sy - (sy - this.y) * r });
  }

  private goalK: number | null = null;
  /** smooth anchored zoom (wheel, buttons, double-click); successive calls accumulate */
  zoomSmooth(f: number, sx: number, sy: number, dur = 0.42) {
    const base = this.tw && this.goalK != null ? this.goalK : this.k;
    const k1 = Math.min(this.kMax, Math.max(this.kMin, base * f));
    const anchor = this.toWorld(sx, sy);
    if (!this.motion()) { this.stop(); this.set(this.centerState(anchor, k1, sx, sy)); return; }
    this.stop();
    this.goalK = k1;
    const k0 = this.k, p = this.proxy; p.k = 0;
    this.tw = gsap.to(p, {
      k: 1, duration: dur, ease: 'power3.out',
      onUpdate: () => {
        const k = Math.exp(Math.log(k0) + (Math.log(k1) - Math.log(k0)) * p.k);
        this.set(this.centerState(anchor, k, sx, sy));
      },
      onComplete: () => { this.tw = null; this.goalK = null; },
    });
  }
  panBy(dx: number, dy: number) { this.set({ k: this.k, x: this.x + dx, y: this.y + dy }); }
}
