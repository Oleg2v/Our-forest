/* Geometry for the WebGL scene: tubes (branches, roots), the island (body, cap, cut face),
   instanced leaf quads, fruits, the plaque plank, and the leaf atlas (drawn with the same
   SVG paths as the vector fallback). */
import {
  BufferGeometry, BufferAttribute, Float32BufferAttribute, Uint32BufferAttribute, InstancedBufferGeometry, InstancedBufferAttribute,
  Shape, ExtrudeGeometry, IcosahedronGeometry, SphereGeometry, CylinderGeometry, BoxGeometry, CanvasTexture,
  LinearMipmapLinearFilter, LinearFilter,
} from 'three';
import type { IslandModel, TreeModel } from '../model';
import { ISLAND, PLAQUE } from '../model';
import { LEAF_ART, COTYLEDON, BLOSSOM, BELL, GRASS, type FruitShape } from '../species';
import { TAU, lerp } from '../util';

/* ------------------------------------------------------------------ dynamic tubes */
export class TubeBuffer {
  geo = new BufferGeometry();
  private cap = 0;
  private pos!: Float32Array; private nor!: Float32Array; private uv!: Float32Array; private sw!: Float32Array; private idx!: Uint32Array;
  constructor(public radial: number) { this.alloc(4096); }
  private alloc(verts: number) {
    this.cap = verts;
    this.pos = new Float32Array(verts * 3); this.nor = new Float32Array(verts * 3); this.uv = new Float32Array(verts * 2); this.sw = new Float32Array(verts * 4);
    this.idx = new Uint32Array(verts * 6);
    const g = this.geo;
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new BufferAttribute(this.uv, 2));
    g.setAttribute('aSway', new BufferAttribute(this.sw, 4));
    g.setIndex(new BufferAttribute(this.idx, 1));
  }
  /**
   * chains: list of point lists; P(i) gives [x,y,z], R(i) radius, S(i) [phase, flex, swayOn, extra]
   */
  build(chains: number[][], P: (i: number, k: number) => [number, number, number], R: (i: number, k: number) => number,
    S: (i: number) => [number, number, number, number], tipScale = 0.5) {
    const rad = this.radial;
    let need = 0;
    for (const ch of chains) need += ch.length * (rad + 1) + 1;
    if (need > this.cap) {
      this.geo.dispose();
      this.geo = new BufferGeometry();
      this.alloc(Math.ceil(need * 1.3));
    }
    const pos = this.pos, nor = this.nor, uv = this.uv, sw = this.sw, idx = this.idx;
    let v = 0, ii = 0;
    for (const ch of chains) {
      const m = ch.length;
      if (m < 2) continue;
      const pts: [number, number, number][] = ch.map((i, k) => P(i, k));
      // drop zero-length segments
      let N: [number, number, number] | null = null;
      let u = 0;
      const base = v;
      for (let k = 0; k < m; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(m - 1, k + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        if (!N) {
          // initial normal: perpendicular to the tangent
          const ax = Math.abs(ty) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          let nx = ax[1] * tz - ax[2] * ty, ny = ax[2] * tx - ax[0] * tz, nz = ax[0] * ty - ax[1] * tx;
          const nl = Math.hypot(nx, ny, nz) || 1; N = [nx / nl, ny / nl, nz / nl];
        } else {
          // parallel transport
          const Np: [number, number, number] = N;
          const d = Np[0] * tx + Np[1] * ty + Np[2] * tz;
          const nx: number = Np[0] - tx * d, ny: number = Np[1] - ty * d, nz: number = Np[2] - tz * d;
          const nl: number = Math.hypot(nx, ny, nz) || 1; N = [nx / nl, ny / nl, nz / nl];
        }
        const B = [ty * N[2] - tz * N[1], tz * N[0] - tx * N[2], tx * N[1] - ty * N[0]];
        if (k > 0) u += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
        let r = R(ch[k], k);
        if (k === m - 1) r *= tipScale;
        const s = S(ch[k]);
        for (let j = 0; j <= rad; j++) {
          const an = (j / rad) * TAU, c = Math.cos(an), sn = Math.sin(an);
          const nx = N[0] * c + B[0] * sn, ny = N[1] * c + B[1] * sn, nz = N[2] * c + B[2] * sn;
          pos[v * 3] = pts[k][0] + nx * r; pos[v * 3 + 1] = pts[k][1] + ny * r; pos[v * 3 + 2] = pts[k][2] + nz * r;
          nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
          uv[v * 2] = u * 6; uv[v * 2 + 1] = j / rad;
          sw[v * 4] = s[0]; sw[v * 4 + 1] = s[1]; sw[v * 4 + 2] = s[2]; sw[v * 4 + 3] = s[3];
          v++;
        }
        if (k > 0) {
          const r0 = base + (k - 1) * (rad + 1), r1 = base + k * (rad + 1);
          for (let j = 0; j < rad; j++) {
            idx[ii++] = r0 + j; idx[ii++] = r1 + j + 1; idx[ii++] = r1 + j;
            idx[ii++] = r0 + j; idx[ii++] = r0 + j + 1; idx[ii++] = r1 + j + 1;
          }
        }
      }
      // tip cone
      const last = pts[m - 1], prev = pts[m - 2];
      let tx = last[0] - prev[0], ty = last[1] - prev[1], tz = last[2] - prev[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const rr = R(ch[m - 1], m - 1) * tipScale;
      pos[v * 3] = last[0] + tx * rr * 0.9; pos[v * 3 + 1] = last[1] + ty * rr * 0.9; pos[v * 3 + 2] = last[2] + tz * rr * 0.9;
      nor[v * 3] = tx; nor[v * 3 + 1] = ty; nor[v * 3 + 2] = tz;
      uv[v * 2] = u * 6; uv[v * 2 + 1] = 0;
      const s = S(ch[m - 1]);
      sw[v * 4] = s[0]; sw[v * 4 + 1] = s[1]; sw[v * 4 + 2] = s[2]; sw[v * 4 + 3] = s[3];
      const r1 = base + (m - 1) * (rad + 1);
      for (let j = 0; j < rad; j++) { idx[ii++] = r1 + j; idx[ii++] = r1 + j + 1; idx[ii++] = v; }
      v++;
    }
    const g = this.geo;
    for (const name of ['position', 'normal', 'uv', 'aSway']) {
      const at = g.getAttribute(name) as BufferAttribute;
      at.needsUpdate = true;
      at.clearUpdateRanges?.();
    }
    (g.index as BufferAttribute).needsUpdate = true;
    g.setDrawRange(0, ii);
    g.computeBoundingSphere();
    return { verts: v, indices: ii };
  }
  dispose() { this.geo.dispose(); }
}

/* ------------------------------------------------------------------ island */
export function islandBody(I: IslandModel, seg: number, rows: number): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], sw: number[] = [], uvs: number[] = [];
  const P = (a: number, s: number): [number, number, number] => {
    const r = I.radius(a, s);
    return [Math.cos(a) * r, I.yAt(s), Math.sin(a) * r];
  };
  for (let ri = 0; ri <= rows; ri++) {
    const s = Math.min(0.999, (ri / rows));
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * TAU;
      const p = P(a, s);
      const e = 1e-3;
      const pa = P(a + e, s), ps = P(a, Math.min(0.9995, s + e)), pm = P(a, Math.max(0, s - e));
      const da = [pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]];
      const ds = [ps[0] - pm[0], ps[1] - pm[1], ps[2] - pm[2]];
      let nx = da[1] * ds[2] - da[2] * ds[1], ny = da[2] * ds[0] - da[0] * ds[2], nz = da[0] * ds[1] - da[1] * ds[0];
      // outward
      if (nx * p[0] + nz * p[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      pos.push(p[0], p[1], Math.min(ISLAND.ZC, p[2]));
      nor.push(nx / nl, ny / nl, nz / nl);
      sw.push(0, 0, 0, s);
      uvs.push(k / seg, s);
    }
  }
  const idx: number[] = [];
  const W = seg + 1;
  for (let ri = 0; ri < rows; ri++) for (let k = 0; k < seg; k++) {
    const a = ri * W + k, b = a + W;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aSway', new Float32BufferAttribute(sw, 4));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}

export function islandCap(I: IslandModel, seg: number): BufferGeometry {
  const pos: number[] = [0, 0, 0], nor: number[] = [0, 1, 0], sw: number[] = [0, 0, 0, 0], uvs: number[] = [0, 0];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * TAU, r = I.rimR(a);
    const z = Math.sin(a) * r;
    const clamped = z > ISLAND.ZC;
    pos.push(Math.cos(a) * r, 0, Math.min(ISLAND.ZC, z));
    nor.push(0, 1, 0);
    sw.push(0, 0, 0, clamped ? 0.9 : 1);
    uvs.push(0, 0);
  }
  const idx: number[] = [];
  for (let k = 1; k <= seg; k++) idx.push(0, k + 1 > seg + 1 ? 1 : k + 1, k);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aSway', new Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  return g;
}

/** the cut face (plane z = ZC): strip between the left and right outline; uv = distances to the edges */
export function islandFace(I: IslandModel, cols = 16): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], sw: number[] = [];
  const rows = I.face;
  for (const row of rows) {
    for (let c = 0; c <= cols; c++) {
      const x = lerp(row.xl, row.xr, c / cols);
      pos.push(x, row.y, ISLAND.ZC + 0.002);
      nor.push(0, 0, 1);
      uvs.push(x - row.xl, row.xr - x);
      sw.push(0, 0, 0, 0);
    }
  }
  const idx: number[] = [];
  const W = cols + 1;
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols; c++) {
    const a = r * W + c, b = a + W;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aSway', new Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------------ leaves */
export function leafQuad(): BufferGeometry {
  // 3 × 3 grid, the midrib slightly raised (a folded leaf catches light on two sides)
  const pos: number[] = [];
  for (let r = 0; r <= 2; r++) for (let c = 0; c <= 2; c++) {
    const x = c / 2 - 0.5, y = r / 2;
    pos.push(x, y, c === 1 ? 0.09 * Math.sin((y) * Math.PI * 0.9 + 0.2) : 0);
  }
  const idx: number[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const a = r * 3 + c, b = a + 3;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export interface InstancedLeaves {
  geo: InstancedBufferGeometry;
  cap: number;
  pos: Float32Array; dir: Float32Array; nrm: Float32Array; size: Float32Array; misc: Float32Array; color: Float32Array;
}
export function makeInstancedLeaves(cap: number): InstancedLeaves {
  const base = leafQuad();
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  const L: InstancedLeaves = {
    geo, cap,
    pos: new Float32Array(cap * 3), dir: new Float32Array(cap * 3), nrm: new Float32Array(cap * 3),
    size: new Float32Array(cap * 4), misc: new Float32Array(cap * 4), color: new Float32Array(cap * 3),
  };
  geo.setAttribute('iPos', new InstancedBufferAttribute(L.pos, 3));
  geo.setAttribute('iDir', new InstancedBufferAttribute(L.dir, 3));
  geo.setAttribute('iNrm', new InstancedBufferAttribute(L.nrm, 3));
  geo.setAttribute('iSize', new InstancedBufferAttribute(L.size, 4));
  geo.setAttribute('iMisc', new InstancedBufferAttribute(L.misc, 4));
  geo.setAttribute('iColor', new InstancedBufferAttribute(L.color, 3));
  geo.instanceCount = 0;
  return L;
}
export function touchInstanced(geo: InstancedBufferGeometry, names: string[]) {
  for (const n of names) (geo.getAttribute(n) as InstancedBufferAttribute).needsUpdate = true;
}

/* ------------------------------------------------------------------ fruits */
export function fruitGeometry(shape: FruitShape): BufferGeometry {
  let g: BufferGeometry;
  if (shape === 'pod') {
    // a bent carob pod hanging from the origin
    const segs = 9, rad = 6;
    const pos: number[] = [], nor: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const cx = Math.sin(t * 1.6) * 0.18, cy = -t;
      const w = 0.09 * Math.sin(Math.min(1, t * 1.15 + 0.08) * Math.PI) + 0.012;
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * TAU;
        const nx = Math.cos(a), nz = Math.sin(a);
        pos.push(cx + nx * w * 1.3, cy, nz * w * 0.55);
        nor.push(nx, 0, nz);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
  } else {
    g = new IcosahedronGeometry(0.5, 2);
    const p = g.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (shape === 'fig') { const k = y > 0 ? 1 - y * 1.05 : 1; x *= k * 1.05; z *= k * 1.05; y *= 1.15; }
      else if (shape === 'olive') { y *= 1.3; x *= 0.85; z *= 0.85; }
      else if (shape === 'almond') { y *= 1.25; x *= 0.8; z *= 0.6; }
      else if (shape === 'berry') { y *= 1.45; const b = 1 + 0.08 * Math.sin(x * 30) * Math.sin(y * 30); x *= 0.8 * b; z *= 0.8 * b; }
      p.setXYZ(i, x, y - 0.55, z);
    }
    g.computeVertexNormals();
  }
  g.setAttribute('aSway', new Float32BufferAttribute(new Float32Array((g.getAttribute('position') as BufferAttribute).count * 4), 4));
  return g;
}

/* ------------------------------------------------------------------ plaque, token, stakes */
export function plaqueGeometry(): { geo: BufferGeometry; box: [number, number, number, number] } {
  const w = PLAQUE.w, h = PLAQUE.h;
  const R = h * 0.3, r = h * 0.06;
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  // image space has y down: big radii at top-left & bottom-right of the picture
  const s = new Shape();
  s.moveTo(x0 + R, y1);
  s.lineTo(x1 - r, y1); s.quadraticCurveTo(x1, y1, x1, y1 - r);
  s.lineTo(x1, y0 + R); s.quadraticCurveTo(x1, y0, x1 - R, y0);
  s.lineTo(x0 + r, y0); s.quadraticCurveTo(x0, y0, x0, y0 + r);
  s.lineTo(x0, y1 - R); s.quadraticCurveTo(x0, y1, x0 + R, y1);
  const geo = new ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
  geo.setAttribute('aSway', new Float32BufferAttribute(new Float32Array((geo.getAttribute('position') as BufferAttribute).count * 4), 4));
  return { geo, box: [x0, y0, w, h] };
}
export function tokenGeometry(r: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, 0.008, 32, 1);
  g.rotateX(Math.PI / 2);
  g.setAttribute('aSway', new Float32BufferAttribute(new Float32Array((g.getAttribute('position') as BufferAttribute).count * 4), 4));
  return g;
}
export function stickGeometry(w: number, h: number, d: number, y0: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, y0 + h / 2, 0);
  g.setAttribute('aSway', new Float32BufferAttribute(new Float32Array((g.getAttribute('position') as BufferAttribute).count * 4), 4));
  return g;
}
export function seedGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 24, 16);
  const p = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setX(i, x * (1 + 0.12 * x)); }
  g.computeVertexNormals();
  g.setAttribute('aSway', new Float32BufferAttribute(new Float32Array(p.count * 4), 4));
  return g;
}
export function tuftGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/* ------------------------------------------------------------------ atlas */
/** 2×2 atlas: 0 species leaf · 1 seedling leaf · 2 blossom / bell · 3 grass. R = ink lines, A = shape.
 *  Narrow leaves are stretched to fill their cell (so mipmaps keep their alpha) and drawn on narrow quads:
 *  `aspect` tells the renderer the quad width / length for cells 0 and 1. */
export function leafAtlas(m: TreeModel): { tex: CanvasTexture; aspect: [number, number] } {
  const S = 512, C = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  const draw = (cell: number, outline: string, veins: string, lw: number, aspect: number) => {
    const cx = (cell % 2) * C, cy = (1 - Math.floor(cell / 2)) * C;
    const sy = (C * 0.94) / 100, sx = sy / aspect;
    const mtx = new DOMMatrix().translate(cx + C / 2 - 50 * sx, cy + C * 0.03).scale(sx, sy);
    const o = new Path2D(); o.addPath(new Path2D(outline), mtx);
    ctx.fillStyle = '#000'; ctx.fill(o);
    ctx.strokeStyle = '#f00'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = lw * sy; ctx.stroke(o);
    if (veins) {
      const v = new Path2D(); v.addPath(new Path2D(veins), mtx);
      ctx.lineWidth = lw * sy * 0.62; ctx.globalAlpha = 0.75; ctx.stroke(v); ctx.globalAlpha = 1;
    }
  };
  const art = LEAF_ART[m.species.leaf.shape];
  const a0 = Math.min(1, Math.max(0.24, art.aspect * 1.18));
  const a1 = Math.min(1, Math.max(0.24, COTYLEDON.aspect * 1.18));
  draw(0, art.outline, art.veins, m.species.leaf.shape === 'olive' ? 4.6 : 4.2, a0);
  draw(1, COTYLEDON.outline, COTYLEDON.veins, 4.2, a1);
  if (m.species.bloom?.bell) draw(2, BELL.outline, BELL.veins, 4.2, 1);
  else draw(2, BLOSSOM.outline, BLOSSOM.veins, 3.6, 1);
  // grass: strokes only
  ctx.save(); ctx.translate(C + C * 0.03, C * 0.03); ctx.scale((C * 0.94) / 100, (C * 0.94) / 100);
  ctx.strokeStyle = '#f00'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.stroke(new Path2D(GRASS)); ctx.restore();
  const tex = new CanvasTexture(c);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return { tex, aspect: [a0, a1] };
}
