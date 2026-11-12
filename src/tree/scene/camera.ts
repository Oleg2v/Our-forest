/* Shared camera + island transform. Both renderers (WebGL and SVG) and the hotspot / picking code
   use exactly this projection, so the 3D scene, its SVG twin and the UI proxies always line up.
   World = island space after the island transform (bob, yaw, tilt). Camera looks at a target with
   a fixed pitch (looking slightly down), perspective with an off-centre principal point (cx, cy). */
import { ISLAND } from './model';
import type { V3 } from './util';

export interface CamParams {
  tx: number; ty: number; tz: number;   // look-at target (world)
  dist: number;                          // camera distance from target
  pitch: number;                         // radians, + = looking down
  fov: number;                           // vertical field of view (radians), before zoom
  zoom: number;                          // focal multiplier (pinch)
  w: number; h: number;                  // viewport CSS px
  cx: number; cy: number;                // principal point CSS px
}
export interface IslandXf { yaw: number; tilt: number; bob: number; treeScale: number }

/** rotation pivot for the island (a point inside the soil under the trunk) */
export const PIVOT: V3 = [0, -0.35, 0.15];

export class Projector {
  cam: CamParams = { tx: 0, ty: 0.6, tz: 0, dist: 6, pitch: 0.16, fov: 0.52, zoom: 1, w: 1, h: 1, cx: 0.5, cy: 0.5 };
  xf: IslandXf = { yaw: 0, tilt: 0, bob: 0, treeScale: 1 };
  // derived
  private F = 1;
  private cp: V3 = [0, 0, 0];
  private sp = 0; private cpch = 1;
  private cy_ = 1; private sy_ = 0; private ct = 1; private st = 0;

  update(cam: CamParams, xf: IslandXf) {
    this.cam = cam; this.xf = xf;
    this.F = (cam.h / 2) / Math.tan(cam.fov / 2) * cam.zoom;
    this.sp = Math.sin(cam.pitch); this.cpch = Math.cos(cam.pitch);
    this.cp = [cam.tx, cam.ty + this.sp * cam.dist, cam.tz + this.cpch * cam.dist];
    this.cy_ = Math.cos(xf.yaw); this.sy_ = Math.sin(xf.yaw);
    this.ct = Math.cos(xf.tilt); this.st = Math.sin(xf.tilt);
  }
  get focal() { return this.F; }

  /** island space → world */
  islandToWorld(x: number, y: number, z: number, out: V3 = [0, 0, 0]): V3 {
    // around the pivot: tilt (x axis) then yaw (y axis), then bob
    let px = x - PIVOT[0], py = y - PIVOT[1], pz = z - PIVOT[2];
    const y1 = py * this.ct - pz * this.st, z1 = py * this.st + pz * this.ct;
    py = y1; pz = z1;
    const x2 = px * this.cy_ + pz * this.sy_, z2 = -px * this.sy_ + pz * this.cy_;
    out[0] = x2 + PIVOT[0]; out[1] = py + PIVOT[1] + this.xf.bob; out[2] = z2 + PIVOT[2];
    return out;
  }
  /** tree space (base at origin) → island space */
  treeToIsland(x: number, y: number, z: number, out: V3 = [0, 0, 0]): V3 {
    const s = this.xf.treeScale;
    out[0] = x * s; out[1] = y * s; out[2] = ISLAND.ZT + z * s;
    return out;
  }
  /** world → screen CSS px; returns [sx, sy, forwardDepth] (depth ≤ 0 → behind the camera) */
  worldToScreen(x: number, y: number, z: number, out: V3 = [0, 0, 0]): V3 {
    const dx = x - this.cp[0], dy = y - this.cp[1], dz = z - this.cp[2];
    // basis: r = (1,0,0), u = (0, cos p, -sin p), f = (0, -sin p, -cos p)
    const xv = dx;
    const yv = dy * this.cpch - dz * this.sp;
    const zf = -dy * this.sp - dz * this.cpch;
    const k = this.F / Math.max(1e-4, zf);
    out[0] = this.cam.cx + xv * k; out[1] = this.cam.cy - yv * k; out[2] = zf;
    return out;
  }
  private tmp: V3 = [0, 0, 0];
  island(x: number, y: number, z: number, out: V3 = [0, 0, 0]): V3 {
    this.islandToWorld(x, y, z, this.tmp);
    return this.worldToScreen(this.tmp[0], this.tmp[1], this.tmp[2], out);
  }
  tree(x: number, y: number, z: number, out: V3 = [0, 0, 0]): V3 {
    this.treeToIsland(x, y, z, this.tmp);
    this.islandToWorld(this.tmp[0], this.tmp[1], this.tmp[2], this.tmp);
    return this.worldToScreen(this.tmp[0], this.tmp[1], this.tmp[2], out);
  }
  /** CSS px per model unit at a given forward depth */
  pxPerUnit(depth: number) { return this.F / Math.max(1e-4, depth); }

  /* ---- matrices for three.js (column-major) ---- */
  viewMatrix(out: Float32Array | number[]) {
    const sp = this.sp, cp = this.cpch, c = this.cp;
    // rows: r=(1,0,0), u=(0,cp,-sp), b=-f=(0,sp,cp)
    const m = [
      1, 0, 0, 0,
      0, cp, sp, 0,
      0, -sp, cp, 0,
      -c[0], -(c[1] * cp - c[2] * sp), -(c[1] * sp + c[2] * cp), 1,
    ];
    for (let i = 0; i < 16; i++) out[i] = m[i];
    return out;
  }
  cameraPosition(): V3 { return [...this.cp] as V3; }
  /** asymmetric perspective; returns [left, right, top, bottom] at `near` */
  frustum(near: number): [number, number, number, number] {
    const { w, h, cx, cy } = this.cam;
    const F = this.F;
    const ox = cx - w / 2;
    // three: ndc = (2n/(r-l))·x/(-z) − (r+l)/(r-l)  → the off-axis terms carry a minus sign
    const rl = (near * w) / F, rpl = -rl * (2 * ox / w);
    const tb = (near * h) / F, tpb = -tb * ((h - 2 * cy) / h);
    const right = (rpl + rl) / 2, left = (rpl - rl) / 2;
    const top = (tpb + tb) / 2, bottom = (tpb - tb) / 2;
    return [left, right, top, bottom];
  }
  islandMatrix(out: Float32Array | number[]) {
    // M = T(pivot + bob) · Ry(yaw) · Rx(tilt) · T(-pivot)
    const cyw = this.cy_, syw = this.sy_, ct = this.ct, st = this.st;
    // R = Ry * Rx
    const r00 = cyw, r01 = syw * st, r02 = syw * ct;
    const r10 = 0, r11 = ct, r12 = -st;
    const r20 = -syw, r21 = cyw * st, r22 = cyw * ct;
    const [px, py, pz] = PIVOT;
    const tx = px - (r00 * px + r01 * py + r02 * pz);
    const ty = py - (r10 * px + r11 * py + r12 * pz) + this.xf.bob;
    const tz = pz - (r20 * px + r21 * py + r22 * pz);
    const m = [r00, r10, r20, 0, r01, r11, r21, 0, r02, r12, r22, 0, tx, ty, tz, 1];
    for (let i = 0; i < 16; i++) out[i] = m[i];
    return out;
  }
}

export interface Composition { cx: number; cy: number; fracH: number; fracW: number; portrait: boolean }
/** where the island sits in the viewport: phone → top 60 %; desktop → centred */
export function composition(w: number, h: number, el?: HTMLElement | null): Composition {
  const portrait = w / Math.max(1, h) < 0.8;
  let cx = 0.5, cy = portrait ? 0.335 : 0.515, fracH = portrait ? 0.5 : 0.76, fracW = portrait ? 0.8 : 0.62;
  if (el) {
    try {
      const cs = getComputedStyle(el);
      const num = (n: string) => { const v = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(v) ? v : null; };
      cx = num('--tree-scene-cx') ?? cx;
      cy = num('--tree-scene-cy') ?? cy;
      fracH = num('--tree-scene-fill') ?? fracH;
    } catch { /* ignore */ }
  }
  return { cx: cx * w, cy: cy * h, fracH, fracW, portrait };
}

/** fit a content box (island space) into the composition; returns target + distance */
export function fit(min: V3, max: V3, comp: Composition, w: number, h: number, fov: number, pitch: number) {
  const tan = Math.tan(fov / 2);
  const H = (max[1] - min[1]) * Math.cos(pitch) + (max[2] - min[2]) * Math.sin(pitch) * 0.6;
  const W = max[0] - min[0];
  const dH = H / (2 * tan * comp.fracH);
  const dW = (W * h) / (2 * tan * w * comp.fracW);
  const dist = Math.max(dH, dW) + (max[2] - min[2]) * 0.35;
  return { tx: (min[0] + max[0]) / 2, ty: (min[1] + max[1]) / 2, tz: (min[2] + max[2]) / 2, dist };
}
