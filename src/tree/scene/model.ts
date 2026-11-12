/* ==========================================================================
   Tree model — generated from (seed, species). Shared by the SVG fallback and the WebGL scene.
   • Island: a floating soil island cut by the plane z = ZC (cross-section toward the camera):
     top cap at y = 0, a tapering earth body, three strata on the cut face, grass, fallen leaves.
   • Tree: space colonization inside a species crown envelope (multi-stem, twist, lean, droop),
     every node carries its "birth time" t (0..1) so the tree can grow continuously with age.
   • Roots: a branching system drawn in the cut face, growing outward from the seed.
   • grow(model, params) → what is visible at a given age / season (cheap, called while scrubbing).
   Model units: island radius 1, adult tree ≈ 2.6–3 tall, tree base at (0, 0, ZT).
   ========================================================================== */
import type { Season } from '../../core/format';
import type { SpeciesId } from '../../components/forest-map';
import { speciesDef, type SpeciesDef } from './species';
import { Rng, clamp, lerp, smooth, noise1, noise2, noiseAngle, TAU, type V3, type RGB, mixC, hash1 } from './util';

export const ISLAND = { R: 1.0, D: 1.18, ZC: 0.3, ZT: 0.255, SEED_Y: -0.15 } as const;
/** plaque & token placement (island space) */
export const PLAQUE = { x: -0.34, y: 0.23, z: ISLAND.ZC - 0.035, w: 0.46, h: 0.46 / 2.4, tilt: -0.1, yaw: 0.1 } as const;
export const TOKEN = { x: -0.5, y: 0.085, z: ISLAND.ZC - 0.022, r: 0.046 } as const;

/* ------------------------------------------------------------------ island */
export interface IslandModel {
  seed: number;
  rimR(a: number): number;
  radius(a: number, s: number): number;
  yAt(s: number): number;
  /** cut-face outline rows from the top (s = 0) down to where the body leaves the plane */
  face: { s: number; y: number; xl: number; xr: number }[];
  faceBottom: number;
  /** half width of the cut face at height y (for clamping roots) */
  halfWidth(y: number): number;
  /** strata boundaries (y) as functions of x: humus/clay and clay/stones */
  b1(x: number): number;
  b2(x: number): number;
  strataPhase: number[];
  pebbles: { x: number; y: number; rx: number; ry: number; rot: number; shade: number }[];
  tufts: { x: number; z: number; s: number; rot: number; lean: number }[];
  fallen: { x: number; z: number; rot: number; s: number; c: number }[];
  sibling: { x: number; z: number; r: number };
}

function makeIsland(seed: number): IslandModel {
  const rng = new Rng(seed * 7 + 11);
  const { R, D, ZC } = ISLAND;
  const ks = rng.range(0, 100);
  const rimR = (a: number) => R * (1 + 0.045 * noiseAngle(a, 1.3, ks) + 0.018 * noiseAngle(a, 3.1, ks + 4));
  const prof = (s: number) => Math.pow(Math.max(0, 1 - Math.pow(s, 1.75)), 0.62);
  const radius = (a: number, s: number) => {
    const lumps = 1 + (0.05 + 0.12 * s * s) * noise2(Math.cos(a) * 1.6 + s * 2.2 + ks, Math.sin(a) * 1.6 + s * 3.3);
    const drips = 1 + 0.08 * s * noiseAngle(a, 4.2, ks + 9);
    return rimR(a) * prof(s) * lumps * drips;
  };
  const yAt = (s: number) => -D * s;
  const face: IslandModel['face'] = [];
  const ROWS = 44;
  for (let i = 0; i <= ROWS; i++) {
    const s = (i / ROWS) * 0.995;
    // right crossing θ ∈ (0, π/2), left θ ∈ (π/2, π)
    const solve = (left: boolean) => {
      let th = Math.PI / 2 * (left ? 1.4 : 0.6);
      for (let k = 0; k < 8; k++) {
        const r = radius(th, s);
        if (r <= ZC) return null;
        const base = Math.asin(clamp(ZC / r, 0, 1));
        th = left ? Math.PI - base : base;
      }
      return radius(th, s) * Math.cos(th);
    };
    const xr = solve(false), xl = solve(true);
    if (xr == null || xl == null || xr - xl < 0.02) break;
    face.push({ s, y: yAt(s), xl, xr });
  }
  const faceBottom = face[face.length - 1].y;
  const halfWidth = (y: number) => {
    if (y > 0) return face[0].xr;
    for (let i = 1; i < face.length; i++) {
      if (face[i].y <= y) {
        const a = face[i - 1], b = face[i], t = (y - a.y) / (b.y - a.y);
        return Math.min(lerp(a.xr, b.xr, t), -lerp(a.xl, b.xl, t));
      }
    }
    return 0;
  };
  const ph = Array.from({ length: 6 }, () => rng.range(0, TAU));
  const b1 = (x: number) => -0.27 + 0.028 * Math.sin(x * 2.7 + ph[0]) + 0.014 * Math.sin(x * 6.3 + ph[1]) + 0.006 * Math.sin(x * 13.1 + ph[2]);
  const b2 = (x: number) => -0.64 + 0.045 * Math.sin(x * 1.9 + ph[3]) + 0.02 * Math.sin(x * 5.2 + ph[4]) + 0.009 * Math.sin(x * 11.7 + ph[5]);

  // pebbles (SVG renderer; the WebGL face uses procedural cells)
  const pebbles: IslandModel['pebbles'] = [];
  for (let tries = 0; tries < 900 && pebbles.length < 64; tries++) {
    const y = lerp(faceBottom + 0.04, -0.3, Math.pow(rng.next(), 0.8));
    const hw = halfWidth(y) - 0.05;
    if (hw <= 0.02) continue;
    const x = rng.range(-hw, hw);
    const inStones = y < b2(x) - 0.02;
    if (!inStones && rng.next() > 0.08) continue;
    if (!inStones && y > b1(x) - 0.04) continue;
    const rx = inStones ? rng.range(0.025, 0.06) : rng.range(0.012, 0.022);
    const ry = rx * rng.range(0.55, 0.85);
    if (pebbles.some((p) => Math.hypot((p.x - x) / (p.rx + rx), (p.y - y) / (p.ry + ry)) < 1.05)) continue;
    pebbles.push({ x, y, rx, ry, rot: rng.range(-0.5, 0.5), shade: rng.next() });
  }
  // grass tufts on the top cap (avoid the plaque and the trunk)
  const tufts: IslandModel['tufts'] = [];
  for (let tries = 0; tries < 600 && tufts.length < 150; tries++) {
    const a = rng.range(0, TAU);
    const rr = Math.sqrt(rng.range(0.04, 1)) * rimR(a) * 0.97;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (z > ZC - 0.025) continue;
    if (Math.hypot(x, z - ISLAND.ZT) < 0.16) continue;
    if (Math.abs(x - PLAQUE.x) < 0.3 && z > PLAQUE.z - 0.1) continue;
    const edge = rr / rimR(a);
    if (edge < 0.6 && rng.next() < 0.55) continue;
    tufts.push({ x, z, s: rng.range(0.05, 0.09) * (0.7 + 0.5 * edge), rot: rng.range(-0.4, 0.4), lean: rng.range(-0.3, 0.3) });
  }
  const fallen: IslandModel['fallen'] = [];
  for (let i = 0; i < 34; i++) {
    const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * 0.78;
    const x = Math.cos(a) * rr, z = ISLAND.ZT - 0.05 + Math.sin(a) * rr * 0.9;
    if (z > ZC - 0.03 || Math.hypot(x, z) > rimR(a) * 0.92) continue;
    fallen.push({ x, z, rot: rng.range(0, TAU), s: rng.range(0.75, 1.15), c: rng.next() });
  }
  return {
    seed, rimR, radius, yAt, face, faceBottom, halfWidth, b1, b2, strataPhase: ph, pebbles, tufts, fallen,
    sibling: { x: 0.56, z: -0.34, r: 0.17 },
  };
}

/* ------------------------------------------------------------------ tree */
export interface TreeModel {
  species: SpeciesDef;
  seed: number;
  island: IslandModel;
  /* skeleton (adult, model units, base at origin) */
  n: number;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  parent: Int32Array;
  t: Float32Array;
  hTip: Uint16Array;
  order: Uint8Array;
  phase: Float32Array;
  flex: Float32Array;
  children: number[][];
  roots: number[];            // stem base nodes
  chains: number[][];         // each chain: node indices, the first one's parent is the attach point
  chainOrder: number[];
  tHide: Float32Array;        // node stops carrying leaves (became interior) — adult reference
  pd: Float32Array;           // path distance from the stem base
  step: number;
  height: number;
  crownC: V3; crownR: V3;
  leaves: LeafSet;
  fruits: PointSet;
  blossoms: PointSet;
  pruneSites: { node: number; dir: V3 }[];
  rootsys: RootSys;
  /** subset of leaf indices for the SVG renderer (≈ 420 at adult) and its size multiplier */
  svgLeafStride: number;
  /** leaves are generated `leafYouth`× denser than the adult shows: a young tree keeps most of them on its
   *  few branches (an evergreen olive sapling is leafy, not bare), the adult thins back to its budget */
  leafYouth: number;
}

export interface LeafSet {
  count: number;
  /** base position (model units) */
  x: Float32Array; y: Float32Array; z: Float32Array;
  /** blade direction (unit) */
  dx: Float32Array; dy: Float32Array; dz: Float32Array;
  /** blade normal (unit) */
  nx: Float32Array; ny: Float32Array; nz: Float32Array;
  size: Float32Array;
  node: Int32Array;
  tShow: Float32Array; tHide: Float32Array;
  r1: Float32Array; r2: Float32Array; r3: Float32Array;
  /** 0..1 how deep inside the crown (for shading) */
  ao: Float32Array;
}
export interface PointSet {
  count: number;
  x: Float32Array; y: Float32Array; z: Float32Array;
  node: Int32Array;
  size: Float32Array;
  rot: Float32Array;
  r: Float32Array;
}
export interface RootSys {
  n: number;
  x: Float32Array; y: Float32Array;
  parent: Int32Array;
  d: Float32Array;        // path distance from the base
  m: Float32Array;        // reveal metric: path distance from the seed
  /** birth close-up metric: downward from the seed only (-1 = not part of the radicle) */
  mr: Float32Array;
  /** tap nodes above the seed (the seedling's underground stem during the birth) */
  up: Uint8Array;
  w: Float32Array;        // adult radius
  order: Uint8Array;
  chains: number[][];
  dMax: number; mMax: number;
}

const leafBudget = (quality: number, mobile: boolean) =>
  quality >= 3 ? (mobile ? 2000 : 4800) : quality === 2 ? (mobile ? 1800 : 3600) : quality === 1 ? (mobile ? 1000 : 1500) : 1200;

export function generateModel(seed: number, speciesId: SpeciesId | string, quality: number, mobile: boolean): TreeModel {
  const sp = speciesDef(speciesId);
  const island = makeIsland(seed);
  const rng = new Rng(seed * 31 + sp.id.length * 977 + 5);
  const C = sp.crown, G = sp.growth, T = sp.trunk;

  /* ---- crown envelope attractors ---- */
  const cc: V3 = [rng.range(-0.06, 0.06), C.cy, rng.range(-0.05, 0.05)];
  const lobes: { c: V3; r: number }[] = [];
  for (let i = 0; i < C.lobes; i++) {
    const d = rng.dir();
    d[1] = d[1] * 0.75 + 0.12;
    lobes.push({ c: [cc[0] + d[0] * C.rx * 0.62, cc[1] + d[1] * C.ry * 0.58, cc[2] + d[2] * C.rz * 0.62], r: C.lobeR * rng.range(0.78, 1.22) });
  }
  const inside = (x: number, y: number, z: number) => {
    if (y < C.floor) return false;
    const ex = (x - cc[0]) / C.rx, ey = (y - cc[1]) / C.ry, ez = (z - cc[2]) / C.rz;
    const e = ex * ex + ey * ey + ez * ez;
    if (e > 1) return false;
    if (e < 0.3) return true;
    for (const l of lobes) {
      const dx = x - l.c[0], dy = y - l.c[1], dz = z - l.c[2];
      if (dx * dx + dy * dy + dz * dz < l.r * l.r) return true;
    }
    return false;
  };
  const att: number[] = [];
  for (let tries = 0; tries < C.attractors * 40 && att.length < C.attractors * 3; tries++) {
    const x = cc[0] + rng.range(-C.rx, C.rx), y = cc[1] + rng.range(-C.ry, C.ry), z = cc[2] + rng.range(-C.rz, C.rz);
    if (inside(x, y, z)) att.push(x, y, z);
  }
  const na = att.length / 3;
  const alive = new Uint8Array(na).fill(1);

  /* ---- nodes ---- */
  const X: number[] = [], Y: number[] = [], Z: number[] = [], PAR: number[] = [], IT: number[] = [];
  const grid = new Map<number, number[]>();
  const cell = G.influence;
  const key = (ix: number, iy: number, iz: number) => ((ix + 64) * 160 + (iy + 64)) * 160 + (iz + 64);
  const addNode = (x: number, y: number, z: number, p: number, it: number) => {
    const i = X.length;
    X.push(x); Y.push(y); Z.push(z); PAR.push(p); IT.push(it);
    const k = key(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell));
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    return i;
  };
  let iter = 0;
  const stems: number[] = [];
  const stemTips: number[] = [];
  const trunkTop = Math.max(0.12, C.floor - G.influence * 0.6);
  for (let k = 0; k < T.stems; k++) {
    const a0 = (k / T.stems) * TAU + rng.range(-0.4, 0.4);
    const bx = Math.cos(a0) * T.spread, bz = Math.sin(a0) * T.spread * 0.7;
    stems.push(addNode(bx, 0, bz, -1, 0));
  }
  // trunk(s): grow straight-ish (lean, twist, gnarl) until the crown attracts
  const leanA = rng.range(0, TAU);
  for (let k = 0; k < T.stems; k++) {
    let cur = stems[k];
    let h = 0;
    const a0 = (k / T.stems) * TAU;
    const stemTop = trunkTop * (T.stems > 1 ? rng.range(0.55, 1.05) : 1);
    const attracted = (i: number) => {
      const r2 = (G.influence * 0.92) ** 2;
      for (let a = 0; a < na; a++) {
        const dx = att[a * 3] - X[i], dy = att[a * 3 + 1] - Y[i], dz = att[a * 3 + 2] - Z[i];
        if (dx * dx + dy * dy + dz * dz < r2) return true;
      }
      return false;
    };
    // grow up to the clear height, then on until the crown attracts the leader
    while (h < stemTop || (!attracted(cur) && h < C.cy + C.ry * 0.6)) {
      const ph = a0 + h * T.twist * 3.2;
      const lean = T.lean * (T.stems > 1 ? 1.4 : 1);
      let dx = Math.cos(T.stems > 1 ? ph : leanA) * lean + Math.sin(h * 7 + k) * T.gnarl * 0.25;
      let dz = Math.sin(T.stems > 1 ? ph : leanA) * lean + Math.cos(h * 6 + k * 2) * T.gnarl * 0.25;
      const l = Math.hypot(dx, 1, dz);
      dx /= l; dz /= l;
      cur = addNode(X[cur] + dx * G.step, Y[cur] + G.step / l, Z[cur] + dz * G.step, cur, 0);
      h = Y[cur];
    }
    stemTips.push(cur);
    iter = Math.max(iter, IT[cur]);
  }

  // space colonization
  const sumX = new Map<number, [number, number, number, number]>();
  const di2 = G.influence * G.influence, dk2 = G.kill * G.kill;
  const childCount = new Map<number, number>();
  let stall = 0;
  for (let step = 0; step < G.maxIter; step++) {
    iter++;
    sumX.clear();
    for (let a = 0; a < na; a++) {
      if (!alive[a]) continue;
      const ax = att[a * 3], ay = att[a * 3 + 1], az = att[a * 3 + 2];
      const cx = Math.floor(ax / cell), cy = Math.floor(ay / cell), cz = Math.floor(az / cell);
      let best = -1, bd = di2;
      for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) {
        const list = grid.get(key(cx + ix, cy + iy, cz + iz));
        if (!list) continue;
        for (const ni of list) {
          const dx = ax - X[ni], dy = ay - Y[ni], dz = az - Z[ni];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bd) { bd = d2; best = ni; }
        }
      }
      if (best < 0) continue;
      if (bd < dk2) { alive[a] = 0; continue; }
      const l = Math.sqrt(bd);
      const acc = sumX.get(best) ?? [0, 0, 0, 0];
      acc[0] += (ax - X[best]) / l; acc[1] += (ay - Y[best]) / l; acc[2] += (az - Z[best]) / l; acc[3]++;
      sumX.set(best, acc);
    }
    let grown = 0;
    for (const [ni, acc] of sumX) {
      if ((childCount.get(ni) ?? 0) >= 3) continue;
      let dx = acc[0], dy = acc[1], dz = acc[2];
      let l = Math.hypot(dx, dy, dz);
      if (l < 0.25 * acc[3]) { dx += rng.range(-0.5, 0.5); dz += rng.range(-0.5, 0.5); l = Math.hypot(dx, dy, dz); }
      dx /= l; dy /= l; dz /= l;
      dy += G.tropism - G.droop * smooth(C.cy - 0.2, C.cy + C.ry, Y[ni]) * 0.6;
      l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const nx = X[ni] + dx * G.step, ny = Y[ni] + dy * G.step, nz = Z[ni] + dz * G.step;
      // avoid duplicates
      let dup = false;
      for (let j = X.length - 1; j >= 0 && j > X.length - 400; j--) {
        if (PAR[j] === ni && (X[j] - nx) ** 2 + (Y[j] - ny) ** 2 + (Z[j] - nz) ** 2 < (G.step * 0.35) ** 2) { dup = true; break; }
      }
      if (dup) continue;
      addNode(nx, ny, nz, ni, iter);
      childCount.set(ni, (childCount.get(ni) ?? 0) + 1);
      grown++;
    }
    if (!grown) { if (++stall > 2) break; } else stall = 0;
  }

  const n = X.length;
  const px = Float32Array.from(X), py = Float32Array.from(Y), pz = Float32Array.from(Z);
  const parent = Int32Array.from(PAR);
  const children: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) if (parent[i] >= 0) children[parent[i]].push(i);
  // smooth the zig-zags of colonization (two Laplacian passes on chain nodes)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const p = parent[i];
      if (p < 0 || children[i].length !== 1 || Y[i] < trunkTop * 0.6) continue;
      const c = children[i][0];
      px[i] = px[i] * 0.5 + (px[p] + px[c]) * 0.25;
      py[i] = py[i] * 0.5 + (py[p] + py[c]) * 0.25;
      pz[i] = pz[i] * 0.5 + (pz[p] + pz[c]) * 0.25;
    }
  }
  // tips-to-root ordering: nodes are created after their parents, so reverse index order is post-order
  const hTip = new Uint16Array(n);
  const tips = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    if (!children[i].length) tips[i] = 1;
    const p = parent[i];
    if (p >= 0) { hTip[p] = Math.max(hTip[p], hTip[i] + 1); tips[p] += tips[i]; }
  }
  // birth time: big structural limbs first (importance = subtree size), each limb extending outward
  // (path distance). A young tree is the adult's main structure, smaller — not a bare pole.
  const pd = new Float32Array(n);
  let pdMax = 0, tipsMax = 1;
  for (let i = 0; i < n; i++) {
    const p = parent[i];
    if (p >= 0) pd[i] = pd[p] + Math.hypot(px[i] - px[p], py[i] - py[p], pz[i] - pz[p]);
    pdMax = Math.max(pdMax, pd[i]); tipsMax = Math.max(tipsMax, tips[i]);
  }
  const t = new Float32Array(n);
  const lt = Math.log(tipsMax + 1);
  for (let i = 0; i < n; i++) {
    const imp = Math.log(tips[i] + 1) / lt;
    t[i] = Math.max(1 - imp, (pd[i] / pdMax) * 0.62);
  }
  for (let i = 0; i < n; i++) { const p = parent[i]; if (p >= 0 && t[i] <= t[p]) t[i] = t[p] + 1e-4; }
  // chains (continuation = child with the most tips)
  const chains: number[][] = [], chainOrder: number[] = [];
  const order = new Uint8Array(n);
  const startChain = (first: number, ord: number) => {
    const chain: number[] = [];
    let cur = first;
    while (cur >= 0) {
      chain.push(cur); order[cur] = ord;
      const ch = children[cur];
      if (!ch.length) break;
      let main = ch[0];
      for (const c of ch) if (tips[c] > tips[main]) main = c;
      for (const c of ch) if (c !== main) pending.push([c, Math.min(ord + 1, 6)]);
      cur = main;
    }
    chains.push(chain); chainOrder.push(ord);
  };
  const pending: [number, number][] = stems.map((s) => [s, 0]);
  while (pending.length) { const [f, o] = pending.shift()!; startChain(f, o); }
  // leaves leave interior nodes once the subtree reaches beyond `reach`
  const reach = sp.leaf.reach;
  const tHide = new Float32Array(n).fill(9);
  for (let i = 0; i < n; i++) {
    let a = i;
    for (let k = 0; k <= reach && a >= 0; k++) a = parent[a];
    if (a >= 0) tHide[a] = Math.min(tHide[a], t[i]);
  }
  const phase = new Float32Array(n), flex = new Float32Array(n);
  for (let ci = 0; ci < chains.length; ci++) {
    const ph = rng.range(0, TAU);
    for (const i of chains[ci]) { phase[i] = ph; flex[i] = clamp(chainOrder[ci] / 3) * 0.8 + 0.2; }
  }
  let height = 0;
  for (let i = 0; i < n; i++) height = Math.max(height, py[i]);

  /* ---- leaves ---- */
  const budget = Math.round(leafBudget(quality, mobile) * sp.leaf.budget);
  let adultSlots = 0;
  for (let i = 0; i < n; i++) if (tHide[i] > 1.5 && py[i] > trunkTop * 0.5) adultSlots++;
  const youth = sp.evergreen ? 2.4 : 1.7;
  const perNode = Math.max(1, budget / Math.max(1, adultSlots)) * youth;
  const LX: number[] = [], LY: number[] = [], LZ: number[] = [], LDX: number[] = [], LDY: number[] = [], LDZ: number[] = [];
  const LNX: number[] = [], LNY: number[] = [], LNZ: number[] = [], LS: number[] = [], LN: number[] = [], LT0: number[] = [], LT1: number[] = [];
  const R1: number[] = [], R2: number[] = [], R3: number[] = [], AO: number[] = [];
  const crownR: V3 = [C.rx, C.ry, C.rz];
  for (let i = 0; i < n; i++) {
    const p = parent[i];
    if (p < 0) continue;
    const interior = tHide[i] <= 1.5;
    const low = py[i] < 0.05;
    if (low) continue;
    let cnt = perNode * (interior ? 0.7 : 1) * (py[i] < trunkTop * 0.5 ? 0.6 : 1);
    let k = Math.floor(cnt) + (rng.next() < cnt - Math.floor(cnt) ? 1 : 0);
    let bx = px[i] - px[p], by = py[i] - py[p], bz = pz[i] - pz[p];
    const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
    // outward from the crown centre
    let ox = px[i] - cc[0], oy = (py[i] - cc[1]) * 0.8, oz = pz[i] - cc[2];
    const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
    const depth = clamp(Math.hypot((px[i] - cc[0]) / C.rx, (py[i] - cc[1]) / C.ry, (pz[i] - cc[2]) / C.rz));
    while (k-- > 0) {
      const along = rng.range(-0.5, 0.4) * G.step;
      const a = rng.range(0, TAU);
      // perpendicular frame around the branch
      let ux = -bz, uy = 0, uz = bx; let ul = Math.hypot(ux, uy, uz);
      if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
      ux /= ul; uz /= ul;
      const vx = by * uz - bz * uy, vy = bz * ux - bx * uz, vz = bx * uy - by * ux;
      const sx = Math.cos(a) * ux + Math.sin(a) * vx, sy = Math.cos(a) * uy + Math.sin(a) * vy, sz = Math.cos(a) * uz + Math.sin(a) * vz;
      const off = sp.leaf.spread * rng.range(0.2, 1);
      const lx = px[i] - bx * along + sx * off, ly = py[i] - by * along + sy * off, lz = pz[i] - bz * along + sz * off;
      // blade direction: away from the branch, outward, slightly up, drooping per species
      let dx = sx * 0.9 + bx * 0.45 + ox * 0.5 + rng.range(-0.3, 0.3);
      let dy = sy * 0.9 + by * 0.45 + oy * 0.3 + 0.25 - G.droop * 2.2 + rng.range(-0.3, 0.3);
      let dz = sz * 0.9 + bz * 0.45 + oz * 0.5 + rng.range(-0.3, 0.3);
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      // normal: (up + outward) made perpendicular to the blade
      let nx = ox * 0.6 + rng.range(-0.4, 0.4), ny = 1 + rng.range(-0.3, 0.3), nz = oz * 0.6 + 0.25 + rng.range(-0.4, 0.4);
      const nd = nx * dx + ny * dy + nz * dz; nx -= dx * nd; ny -= dy * nd; nz -= dz * nd;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      LX.push(lx); LY.push(ly); LZ.push(lz); LDX.push(dx); LDY.push(dy); LDZ.push(dz); LNX.push(nx); LNY.push(ny); LNZ.push(nz);
      LS.push(sp.leaf.len * rng.range(0.78, 1.2)); LN.push(i);
      LT0.push(t[i] + rng.range(0.004, 0.03)); LT1.push(tHide[i] + rng.range(0, 0.04));
      R1.push(rng.next()); R2.push(rng.next()); R3.push(rng.next());
      AO.push(1 - depth);
    }
  }
  const lc = LX.length;
  const F = (a: number[]) => Float32Array.from(a);
  const leaves: LeafSet = {
    count: lc, x: F(LX), y: F(LY), z: F(LZ), dx: F(LDX), dy: F(LDY), dz: F(LDZ), nx: F(LNX), ny: F(LNY), nz: F(LNZ),
    size: F(LS), node: Int32Array.from(LN), tShow: F(LT0), tHide: F(LT1), r1: F(R1), r2: F(R2), r3: F(R3), ao: F(AO),
  };

  /* ---- fruits & blossoms ---- */
  const points = (count: number, pick: (i: number) => boolean, hang: number, size: number): PointSet => {
    const cand: number[] = [];
    for (let i = 0; i < n; i++) if (parent[i] >= 0 && pick(i)) cand.push(i);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const m = Math.min(count, cand.length * 2);
    const out: PointSet = { count: m, x: new Float32Array(m), y: new Float32Array(m), z: new Float32Array(m), node: new Int32Array(m), size: new Float32Array(m), rot: new Float32Array(m), r: new Float32Array(m) };
    for (let k = 0; k < m; k++) {
      const i = cand[k % cand.length];
      out.node[k] = i;
      out.x[k] = px[i] + rng.range(-0.05, 0.05);
      out.y[k] = py[i] - hang * rng.range(0.6, 1.1);
      out.z[k] = pz[i] + rng.range(-0.05, 0.05);
      out.size[k] = size * rng.range(0.82, 1.18);
      out.rot[k] = rng.range(-0.5, 0.5);
      out.r[k] = rng.next();
    }
    return out;
  };
  const fruits = points(sp.fruit.count, (i) => hTip[i] <= 3 && hTip[i] >= 1 && py[i] > C.floor - 0.1, sp.fruit.size * 0.9, sp.fruit.size);
  const blossoms = sp.bloom ? points(sp.bloom.count, (i) => hTip[i] <= 2, 0.01, sp.bloom.size) : points(0, () => false, 0, 0);

  /* ---- fresh pruning cuts: on the trunk / main limbs ---- */
  const pruneSites: TreeModel['pruneSites'] = [];
  for (let ci = 0; ci < chains.length && pruneSites.length < 4; ci++) {
    if (chainOrder[ci] > 1) continue;
    const ch = chains[ci];
    const idx = ch[Math.floor(ch.length * rng.range(0.3, 0.6))];
    if (idx == null || py[idx] < 0.25) continue;
    const a = rng.range(0, TAU);
    pruneSites.push({ node: idx, dir: [Math.cos(a) * 0.8, rng.range(0.1, 0.5), Math.abs(Math.sin(a)) * 0.8 + 0.2] });
  }

  const rootsys = makeRoots(sp, island, rng);
  const adultVisible = (() => { let c = 0; for (let i = 0; i < lc; i++) if (leaves.tHide[i] > 1.2) c++; return c / youth; })();
  return {
    species: sp, seed, island, n, px, py, pz, parent, t, hTip, order, phase, flex, children, roots: stems, chains, chainOrder,
    tHide, pd, step: G.step, height, crownC: cc, crownR, leaves, fruits, blossoms, pruneSites, rootsys,
    svgLeafStride: Math.max(1, Math.round(adultVisible / (sp.leaf.shape === 'fig' ? 260 : sp.leaf.shape === 'olive' ? 760 : 520))),
    leafYouth: youth,
  };
}

/* ------------------------------------------------------------------ roots (in the cut face) */
function makeRoots(sp: SpeciesDef, island: IslandModel, rng: Rng): RootSys {
  const X: number[] = [], Y: number[] = [], PAR: number[] = [], Dd: number[] = [], W: number[] = [], ORD: number[] = [];
  const inFace = (x: number, y: number, margin: number) => y < -0.01 && y > island.faceBottom + margin && Math.abs(x) < island.halfWidth(y) - margin;
  const add = (x: number, y: number, p: number, d: number, w: number, o: number) => {
    X.push(x); Y.push(y); PAR.push(p); Dd.push(d); W.push(w); ORD.push(o); return X.length - 1;
  };
  const STEP = 0.03;
  const seedD = -ISLAND.SEED_Y;
  const grow = (from: number, ang: number, length: number, w0: number, ord: number, bend: number) => {
    let cur = from, a = ang, l = 0;
    const out: number[] = [];
    const seedN = rng.range(0, 50);
    while (l < length) {
      a += noise1(l * 6 + seedN, ord) * 0.18 + bend * 0.04;
      // gravitropism: lean toward straight down
      a = lerp(a, -Math.PI / 2, 0.035 * (ord === 0 ? 0.2 : 1));
      // the tap root runs straight through the seed (x = 0): the seedling's stem rises from it, the radicle leaves it downward
      if (ord === 0 && l < seedD + STEP) a = -Math.PI / 2;
      const nx = X[cur] + Math.cos(a) * STEP, ny = Y[cur] + Math.sin(a) * STEP;
      if (!inFace(nx, ny, 0.05)) break;
      l += STEP;
      const w = w0 * lerp(1, 0.18, l / length);
      cur = add(nx, ny, cur, Dd[cur] + STEP, w, ord);
      out.push(cur);
    }
    return out;
  };
  const base = add(0, -0.005, -1, 0, 0.03, 0);
  const tap = grow(base, -Math.PI / 2 + rng.range(-0.06, 0.06), 0.95 * sp.roots.depth, 0.03, 0, 0);
  const laterals: number[][] = [];
  const nL = sp.roots.laterals;
  for (let k = 0; k < nL; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const at = tap[Math.min(tap.length - 1, Math.floor(lerp(1, Math.min(tap.length - 1, 13), k / Math.max(1, nL - 1)) + rng.range(-1, 1)))];
    if (at == null) continue;
    const down = rng.range(0.15, 0.85) * (k < 2 ? 0.45 : 1);
    const ang = side > 0 ? -down : -Math.PI + down;
    const len = rng.range(0.45, 0.95) * sp.roots.spread * (k < 2 ? 1.1 : 0.9);
    laterals.push(grow(at, ang, len, 0.017 * rng.range(0.8, 1.1), 1, side > 0 ? -0.3 : 0.3));
  }
  for (const lat of laterals) {
    for (let j = 3; j < lat.length - 2; j += rng.int(3, 5)) {
      if (rng.next() < 0.35) continue;
      const i = lat[j], p = PAR[i];
      const a0 = Math.atan2(Y[i] - Y[p], X[i] - X[p]);
      const sub = grow(i, a0 + rng.sign() * rng.range(0.4, 1.0), rng.range(0.08, 0.26), W[i] * 0.6, 2, 0);
      for (let q = 2; q < sub.length; q += 3) if (rng.next() < 0.5) {
        const s = sub[q], sp2 = PAR[s];
        grow(s, Math.atan2(Y[s] - Y[sp2], X[s] - X[sp2]) + rng.sign() * rng.range(0.5, 1.1), rng.range(0.04, 0.09), W[s] * 0.5, 3, 0);
      }
    }
  }
  for (let j = 4; j < tap.length - 2; j += 3) if (rng.next() < 0.55) {
    const i = tap[j];
    grow(i, -Math.PI / 2 + rng.sign() * rng.range(0.6, 1.2), rng.range(0.06, 0.18), W[i] * 0.5, 2, 0);
  }
  const n = X.length;
  const x = Float32Array.from(X), y = Float32Array.from(Y), parent = Int32Array.from(PAR), d = Float32Array.from(Dd), w = Float32Array.from(W);
  // reveal metric from the seed (the seed lies on the tap root at SEED depth)
  const m = new Float32Array(n);
  // birth close-up: the radicle leaves the seed downward only (laterals lag behind the tip); the tap above
  // the seed is the seedling's pale underground stem (hypocotyl); laterals above the seed come later
  const mr = new Float32Array(n);
  const up = new Uint8Array(n);
  const onTap = new Uint8Array(n); onTap[base] = 1; for (const i of tap) onTap[i] = 1;
  const attachD = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (onTap[i]) {
      m[i] = Math.abs(d[i] - seedD); attachD[i] = d[i];
      if (d[i] < seedD) { up[i] = 1; mr[i] = seedD - d[i]; } else mr[i] = d[i] - seedD;
      continue;
    }
    const p = parent[i];
    attachD[i] = onTap[p] ? d[p] : attachD[p];
    m[i] = Math.abs(attachD[i] - seedD) + (d[i] - attachD[i]);
    mr[i] = attachD[i] < seedD + 0.02 ? -1 : (attachD[i] - seedD) + (d[i] - attachD[i]) * 1.6;
  }
  const children: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) if (parent[i] >= 0) children[parent[i]].push(i);
  const chains: number[][] = [];
  const pend = [base];
  while (pend.length) {
    let cur = pend.shift()!;
    const chain = [cur];
    for (;;) {
      const ch = children[cur];
      if (!ch.length) break;
      let main = ch[0];
      for (const c of ch) if (ORD[c] < ORD[main] || (ORD[c] === ORD[main] && w[c] > w[main])) main = c;
      for (const c of ch) if (c !== main) pend.push(c);
      chain.push(main); cur = main;
    }
    if (chain.length > 1) chains.push(chain);
  }
  // branch chains start at their attach point
  for (const ch of chains) { const p = parent[ch[0]]; if (p >= 0) ch.unshift(p); }
  let dMax = 0, mMax = 0;
  for (let i = 0; i < n; i++) { dMax = Math.max(dMax, d[i]); mMax = Math.max(mMax, m[i]); }
  return { n, x, y, parent, d, m, mr, up, w, order: Uint8Array.from(ORD), chains, dMax, mMax };
}

/* ==================================================================== growth by age */
/** ageDays → growth 0..1 (0.06 sapling at planting, ~0.38 at 9 months, ~0.75 first fruit, 1 at five years) */
export function growthOf(ageDays: number): number {
  if (ageDays < 0) return 0.06;
  const k = 700, span = 1 - Math.exp(-1825 / k);
  return clamp(0.06 + 0.94 * (1 - Math.exp(-ageDays / k)) / span, 0.06, 1.05);
}
/** share of the skeleton (node birth time) revealed at growth g */
export const revealOf = (g: number) => (g < 0.06 ? (g / 0.06) * 0.3 : 0.3 + ((g - 0.06) / 0.94) * 0.7);
/** overall size at growth g */
export const sizeOf = (g: number) => (g < 0.06 ? lerp(0.22, 0.34, g / 0.06) : lerp(0.34, 1, Math.pow(clamp((g - 0.06) / 0.94, 0, 1.2), 0.7)));
export const rootRevealOf = (g: number) => (g < 0.06 ? lerp(0.0, 0.32, g / 0.06) : lerp(0.32, 1.02, Math.pow(clamp((g - 0.06) / 0.94), 0.8)));

export interface RootPt { x: number; y: number; r: number; d: number }
/** The visible roots as polylines in the cut face (x, y, radius, path distance for the glow). The reveal metric
    is not monotonic along a chain (the tap root grows both ways from the seed), so every chain yields its
    contiguous revealed runs, each cut exactly at the reveal front. */
export function rootRuns(M: TreeModel, G: GrowResult): RootPt[][] {
  const R = M.rootsys, out: RootPt[][] = [];
  const rev = G.rootReveal * R.mMax;
  if (!(rev > 0)) return out;
  const m = G.rootM, rr = G.rootR, tip = G.rootTipR;
  const at = (a: number, b: number, t: number): RootPt => ({
    x: lerp(R.x[a], R.x[b], t), y: lerp(R.y[a], R.y[b], t), r: Math.min(tip, lerp(rr[a], rr[b], t)), d: lerp(R.d[a], R.d[b], t),
  });
  for (const ch of R.chains) {
    let run: RootPt[] | null = null;
    for (let k = 0; k < ch.length; k++) {
      const i = ch[k];
      if (m[i] <= rev) {
        if (!run) {
          run = [];
          if (k > 0) {
            const p = ch[k - 1], t = (rev - m[i]) / Math.max(1e-6, m[p] - m[i]);
            if (t > 0.02) run.push(at(i, p, clamp(t)));
          }
        }
        run.push({ x: R.x[i], y: R.y[i], r: rr[i], d: R.d[i] });
      } else if (run) {
        const p = ch[k - 1], t = (rev - m[p]) / Math.max(1e-6, m[i] - m[p]);
        if (t > 0.02) run.push(at(p, i, clamp(t)));
        if (run.length >= 2) out.push(run);
        run = null;
      }
    }
    if (run && run.length >= 2) out.push(run);
  }
  return out;
}

export interface SeasonLook {
  density: number;   // share of leaves on the tree
  autumn: number;    // share of yellow leaves
  bloom: number;     // blossoms 0..1
  fruit: number;     // fruits 0..1
  fresh: number;     // light spring green 0..1
  falling: number;   // leaves drifting down (per second)
}
export function seasonLook(sp: SpeciesDef, season: Season, g: number, harvestReady: boolean): SeasonLook {
  const mature = smooth(0.5, 0.62, g);
  const fruitAge = smooth(0.66, 0.78, g);
  const bloom = sp.bloom && sp.bloom.seasons.includes(season) ? mature * (season === 'summer' ? 0.5 : 1) : 0;
  const fruitIn = sp.fruit.seasons.includes(season) ? fruitAge : 0;
  const fruit = harvestReady ? Math.max(fruitIn, 1) : fruitIn * 0.85;
  if (sp.evergreen) return { density: 1, autumn: 0, bloom, fruit, fresh: season === 'spring' ? 0.5 : 0, falling: 0.02 };
  switch (season) {
    case 'spring': return { density: 0.82, autumn: 0, bloom, fruit, fresh: 1, falling: 0 };
    case 'summer': return { density: 1, autumn: 0.02, bloom, fruit, fresh: 0, falling: 0.02 };
    case 'autumn': return { density: 0.6, autumn: 0.72, bloom: 0, fruit, fresh: 0, falling: 0.45 };
    case 'winter': return { density: 0.0, autumn: 1, bloom, fruit: 0, fresh: 0, falling: 0 };
  }
}

export interface GrowParams {
  g: number;               // growth (birth: 0 → 0.06 sprout → sapling)
  planted: boolean;
  look: SeasonLook;
  ripe: boolean;
  /** birth: cotyledons 0..1 open, root reveal override */
  cotyledon: number;
  rootReveal: number;
  /** extra root thinness (birth close-up) */
  rootScale?: number;
  /** birth close-up 0..1: the roots are the seed's radicle (thin, tapering, downward only) */
  radicle?: number;
  /** birth: share of the seedling's underground stem grown from the seed to the surface */
  hypocotyl?: number;
}

export interface GrowResult {
  version: number;
  g: number; s: number; reveal: number;
  /** display positions in tree space (scaled) and radii */
  x: Float32Array; y: Float32Array; z: Float32Array; r: Float32Array;
  vis: Uint8Array;
  frac: Float32Array;
  dTip: Float32Array;
  /** visible chain parts: node indices; the first entry is the attach point */
  chains: number[][];
  chainOrd: number[];
  leaves: Int32Array; leafScale: Float32Array; leafCount: number;
  /** per visible leaf: 0 green .. 1 autumn colour; and which autumn tint */
  leafAutumn: Float32Array;
  fruits: Int32Array; fruitScale: Float32Array; fruitCount: number;
  /** display positions (tree space) of the visible fruits / blossoms, packed like `fruits` */
  fruitXYZ: Float32Array;
  blossoms: Int32Array; blossomScale: Float32Array; blossomCount: number;
  blossomXYZ: Float32Array;
  cotyledon: { open: number; x: number; y: number; z: number; size: number } | null;
  rootReveal: number;
  rootW: number;
  /** per root node: effective reveal metric (compare with rootReveal · mMax) and display radius (world units) */
  rootM: Float32Array; rootR: Float32Array;
  /** radius of a growing root tip (world units) and the birth radicle blend (renderers relax their minimum width) */
  rootTipR: number; radicle: number;
  bbox: { min: V3; max: V3 };
  crownC: V3; crownR: number; top: number;
  trunk: { x: number; y: number; z: number; r: number }[];
  perches: V3[];
  greeting: number[];        // visible leaf indices for greeting leaves (front of the crown)
}

let growVersion = 1;
export function grow(M: TreeModel, P: GrowParams, prev?: GrowResult): GrowResult {
  const n = M.n;
  const g = P.planted ? Math.max(0, P.g) : 0;
  const reveal = P.planted ? revealOf(g) : -1;
  const s = sizeOf(g);
  const res: GrowResult = prev && prev.x.length === n ? prev : {
    version: 0, g: 0, s: 0, reveal: 0,
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), r: new Float32Array(n), vis: new Uint8Array(n),
    frac: new Float32Array(n), dTip: new Float32Array(n),
    chains: [], chainOrd: [],
    leaves: new Int32Array(M.leaves.count), leafScale: new Float32Array(M.leaves.count), leafAutumn: new Float32Array(M.leaves.count), leafCount: 0,
    fruits: new Int32Array(M.fruits.count), fruitScale: new Float32Array(M.fruits.count), fruitCount: 0, fruitXYZ: new Float32Array(M.fruits.count * 3),
    blossoms: new Int32Array(M.blossoms.count), blossomScale: new Float32Array(M.blossoms.count), blossomCount: 0, blossomXYZ: new Float32Array(M.blossoms.count * 3),
    cotyledon: null, rootReveal: 0, rootW: 1, rootM: new Float32Array(M.rootsys.n), rootR: new Float32Array(M.rootsys.n), rootTipR: 0.004, radicle: 0,
    bbox: { min: [0, 0, 0], max: [0, 0, 0] }, crownC: [0, 1, 0], crownR: 0.5, top: 0,
    trunk: [], perches: [], greeting: [],
  };
  res.version = growVersion++;
  res.g = g; res.s = s; res.reveal = reveal;
  const { px, py, pz, parent, t } = M;
  const vis = res.vis;
  const tipR = 0.0046 * M.species.trunk.thick;
  // positions + visibility (partial frontier nodes are pulled toward their parent)
  for (let i = 0; i < n; i++) {
    const p = parent[i];
    let f = 0;
    if (P.planted) {
      if (t[i] <= reveal) f = 1;
      else if (p >= 0 && vis[p] === 1) {
        const tp = t[p];
        f = clamp((reveal - tp) / Math.max(1e-4, t[i] - tp));
      } else if (p < 0) f = clamp(reveal / 0.02);
    }
    if (f <= 0.001) { vis[i] = 0; res.r[i] = 0; continue; }
    vis[i] = f >= 1 ? 1 : 2;
    res.frac[i] = f;
    if (p >= 0 && f < 1) {
      res.x[i] = lerp(px[p], px[i], f) * s; res.y[i] = lerp(py[p], py[i], f) * s; res.z[i] = lerp(pz[p], pz[i], f) * s;
    } else {
      res.x[i] = px[i] * s; res.y[i] = py[i] * s * (p < 0 ? 1 : 1); res.z[i] = pz[i] * s;
    }
    res.r[i] = 0;
  }
  // pipe model radii on the visible structure
  for (let i = n - 1; i >= 0; i--) {
    if (!vis[i]) continue;
    const own = res.r[i] === 0 ? Math.pow(tipR * (vis[i] === 2 ? 0.7 : 1), 2.2) : res.r[i];
    const rr = res.r[i] === 0 ? own : res.r[i];
    res.r[i] = rr;
    const p = parent[i];
    if (p >= 0) res.r[p] += rr;
  }
  const radScale = Math.pow(s, 0.35);
  for (let i = 0; i < n; i++) if (vis[i]) res.r[i] = Math.pow(res.r[i], 1 / 2.2) * radScale * (parent[i] < 0 ? 1.08 : 1);
  // chains
  res.chains.length = 0; res.chainOrd.length = 0;
  for (let ci = 0; ci < M.chains.length; ci++) {
    const ch = M.chains[ci];
    if (!vis[ch[0]]) continue;
    const part: number[] = [];
    const p0 = parent[ch[0]];
    if (p0 >= 0) part.push(p0);
    for (const i of ch) { if (!vis[i]) break; part.push(i); if (vis[i] === 2) break; }
    if (part.length >= 2 || (p0 < 0 && part.length >= 1)) { res.chains.push(part); res.chainOrd.push(M.chainOrder[ci]); }
  }
  // trunk samples (for picking & shake)
  res.trunk.length = 0;
  if (res.chains.length) {
    const tc = res.chains[0];
    for (let k = 0; k < tc.length; k += Math.max(1, Math.floor(tc.length / 8))) {
      const i = tc[k];
      res.trunk.push({ x: res.x[i], y: res.y[i], z: res.z[i], r: res.r[i] });
    }
    const last = tc[tc.length - 1];
    res.trunk.push({ x: res.x[last], y: res.y[last], z: res.z[last], r: res.r[last] });
  }

  /* leaves follow the current visible tips (path distance), so a young tree is leafy at its ends */
  const dTip = res.dTip;
  dTip.fill(1e9);
  for (let i = n - 1; i >= 0; i--) {
    if (!vis[i]) continue;
    if (dTip[i] > 1e8) dTip[i] = 0;
    const p = parent[i];
    if (p >= 0 && vis[p]) {
      const seg = (M.pd[i] - M.pd[p]) * (vis[i] === 2 ? res.frac[i] : 1);
      if (dTip[i] + seg < dTip[p]) dTip[p] = dTip[i] + seg;
    }
  }
  const reachLen = M.step * (M.species.leaf.reach + 0.6) * lerp(2.4, 1, smooth(0.25, 1, g));
  const L = M.leaves, look = P.look;
  const sizeK = Math.pow(s, 0.45);
  let lc = 0;
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  let cx = 0, cy = 0, cz = 0, cw = 0;
  const density = look.density;
  // young trees keep (almost) all the generated leaves on their few branches; the adult thins to its budget
  const keep = lerp(1, 1 / Math.max(1, M.leafYouth || 1), smooth(0.3, 1, g));
  if (P.planted) {
    for (let i = 0; i < L.count; i++) {
      const ni = L.node[i];
      if (vis[ni] !== 1) continue;
      if (keep < 1 && hash1(i * 3.17 + 0.71) > keep) continue;
      const rl = reachLen * (0.75 + 0.5 * hash1(i * 1.37));
      const dt = dTip[ni];
      if (dt > rl) continue;
      // the seasons: deciduous leaves drop (keep a stable random subset)
      if (L.r1[i] > density) continue;
      const t0 = L.tShow[i];
      // a sprout shows only its two seedling leaves; true leaves come with the sapling
      const pop = smooth(t0, t0 + 0.025, reveal) * (1 - smooth(rl * 0.7, rl, dt)) * smooth(0.03, 0.06, g);
      if (pop <= 0.02) continue;
      res.leaves[lc] = i;
      res.leafScale[lc] = pop * sizeK;
      res.leafAutumn[lc] = L.r2[i] < look.autumn ? 1 : 0;
      lc++;
      const x = L.x[i] * s, y = L.y[i] * s, z = L.z[i] * s;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      cx += x; cy += y; cz += z; cw++;
    }
  }
  res.leafCount = lc;
  // include branches in the bbox
  for (let i = 0; i < n; i++) if (vis[i]) {
    const x = res.x[i], y = res.y[i], z = res.z[i];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  if (minX > maxX) { minX = maxX = 0; minY = maxY = 0; minZ = maxZ = 0; }
  const pad = M.species.leaf.len * sizeK * 0.8;
  res.bbox = { min: [minX - pad, Math.min(0, minY), minZ - pad], max: [maxX + pad, maxY + pad, maxZ + pad] };
  res.top = maxY + pad;
  if (cw > 0) {
    res.crownC = [cx / cw, cy / cw, cz / cw];
    res.crownR = Math.max(0.12, Math.max(maxX - minX, maxY - Math.max(minY, res.top * 0.35)) * 0.5);
  } else {
    // bare tree: centre on the upper skeleton
    res.crownC = [(minX + maxX) / 2, Math.max(0.1, (maxY + minY) / 2 + (maxY - minY) * 0.15), (minZ + maxZ) / 2];
    res.crownR = Math.max(0.1, (maxY - minY) * 0.4);
  }

  /* fruits & blossoms: they belong to adult twigs; on a younger tree they sit on the nearest visible branch */
  const anchorOf = (node: number) => {
    let a = node;
    while (a >= 0 && vis[a] !== 1) a = parent[a];
    if (a < 0 || (M.order[a] === 0 && py[a] < M.crownC[1] - M.crownR[1] * 0.5)) return -1;
    return a;
  };
  let fc = 0;
  const FR = M.fruits;
  if (P.planted && look.fruit > 0.01) {
    const share = P.ripe ? Math.max(look.fruit, smooth(0.15, 0.6, g) * 0.6 + 0.4) : look.fruit;
    for (let i = 0; i < FR.count; i++) {
      if (FR.r[i] > share) continue;
      const a = anchorOf(FR.node[i]);
      if (a < 0) continue;
      const k = a === FR.node[i] ? 1 : 0.5;
      res.fruits[fc] = i; res.fruitScale[fc] = sizeK * clamp((share - FR.r[i]) * 6);
      res.fruitXYZ[fc * 3] = res.x[a] + (FR.x[i] - px[FR.node[i]]) * s * k;
      res.fruitXYZ[fc * 3 + 1] = res.y[a] + (FR.y[i] - py[FR.node[i]]) * s * (a === FR.node[i] ? 1 : 0.7);
      res.fruitXYZ[fc * 3 + 2] = res.z[a] + (FR.z[i] - pz[FR.node[i]]) * s * k;
      fc++;
    }
  }
  res.fruitCount = fc;
  let bc = 0;
  const BL = M.blossoms;
  if (P.planted && look.bloom > 0.01) {
    for (let i = 0; i < BL.count; i++) {
      if (BL.r[i] > look.bloom) continue;
      const a = anchorOf(BL.node[i]);
      if (a < 0) continue;
      const k = a === BL.node[i] ? 1 : 0.6;
      res.blossoms[bc] = i; res.blossomScale[bc] = sizeK * clamp((look.bloom - BL.r[i]) * 5);
      res.blossomXYZ[bc * 3] = res.x[a] + (BL.x[i] - px[BL.node[i]]) * s * k;
      res.blossomXYZ[bc * 3 + 1] = res.y[a] + (BL.y[i] - py[BL.node[i]]) * s * k;
      res.blossomXYZ[bc * 3 + 2] = res.z[a] + (BL.z[i] - pz[BL.node[i]]) * s * k;
      bc++;
    }
  }
  res.blossomCount = bc;

  /* seedling leaves */
  res.cotyledon = null;
  if (P.planted && P.cotyledon > 0.001 && res.chains.length) {
    const tc = res.chains[0];
    const tip = tc[tc.length - 1];
    res.cotyledon = { open: P.cotyledon, x: res.x[tip], y: res.y[tip], z: res.z[tip], size: 0.05 * (1 - smooth(0.12, 0.3, g)) };
    if (res.cotyledon.size < 0.003) res.cotyledon = null;
  }
  res.rootReveal = P.planted ? P.rootReveal : 0;
  res.rootW = Math.max(0.1, Math.sqrt(clamp(g))) * (P.rootScale ?? 1);
  {
    // roots: the adult system revealed from the seed, or (birth close-up) the radicle + the underground stem
    const R = M.rootsys, rk = clamp(P.radicle ?? 0), hyp = clamp(P.hypocotyl ?? 0);
    const rev = res.rootReveal * R.mMax, seedD = -ISLAND.SEED_Y, far = R.mMax * 3 + 1;
    res.radicle = rk;
    res.rootTipR = lerp(0.004, 0.00045, rk);
    for (let i = 0; i < R.n; i++) {
      const adultR = R.w[i] * res.rootW;
      if (rk <= 0) { res.rootM[i] = R.m[i]; res.rootR[i] = adultR; continue; }
      let mR: number, rR: number;
      if (R.up[i]) {
        // revealed exactly up to hyp · seedD above the seed (independent of the radicle's own front)
        const k = (seedD - Math.min(seedD, R.d[i])) / seedD;
        mR = hyp > 0.001 && rev > 0 ? (k / hyp) * rev : far;
        rR = lerp(0.0021, 0.0017, k);
      } else if (R.mr[i] < 0) { mR = far; rR = 0.0006; }
      else {
        mR = R.mr[i];
        // thick at the seed, tapering to a hair-thin growing tip
        rR = lerp(0.0019, 0.0005, clamp(mR / Math.max(0.02, rev))) * (R.order[i] ? 0.7 : 1);
      }
      res.rootM[i] = lerp(R.m[i], mR, rk);
      res.rootR[i] = lerp(adultR, rR, rk);
    }
  }

  /* bird perches: upper, front, near-horizontal visible branch nodes */
  res.perches.length = 0;
  for (let i = 0; i < n && res.perches.length < 8; i += 3) {
    if (vis[i] !== 1 || M.order[i] < 1 || M.order[i] > 3) continue;
    const p = parent[i];
    if (p < 0) continue;
    const dy = res.y[i] - res.y[p], dl = Math.hypot(res.x[i] - res.x[p], dy, res.z[i] - res.z[p]);
    if (Math.abs(dy) / (dl || 1) > 0.55) continue;
    if (res.y[i] < res.crownC[1] - res.crownR * 0.2 || res.z[i] < res.crownC[2]) continue;
    res.perches.push([res.x[i], res.y[i] + res.r[i], res.z[i]]);
  }
  /* greeting leaves: spread over the front of the crown (farthest point sampling) */
  res.greeting.length = 0;
  if (lc > 0) {
    const cand: number[] = [];
    for (let k = 0; k < lc; k++) {
      const i = res.leaves[k];
      const z = L.z[i] * s;
      if (z < res.crownC[2] + res.crownR * 0.15) continue;
      if (L.y[i] * s < res.crownC[1] - res.crownR * 0.75) continue;
      cand.push(i);
    }
    if (cand.length) {
      let first = cand[0], best = 1e9;
      for (const i of cand) { const d = Math.hypot(L.x[i] * s - res.crownC[0], L.y[i] * s - res.crownC[1] - res.crownR * 0.2); if (d < best) { best = d; first = i; } }
      res.greeting.push(first);
      const md = new Float32Array(cand.length).fill(1e9);
      for (let k = 1; k < 18 && k < cand.length; k++) {
        let bi = -1, bd = -1;
        const last = res.greeting[res.greeting.length - 1];
        for (let c = 0; c < cand.length; c++) {
          const i = cand[c];
          const d = Math.hypot((L.x[i] - L.x[last]) * s, (L.y[i] - L.y[last]) * s * 1.2);
          if (d < md[c]) md[c] = d;
          if (md[c] > bd) { bd = md[c]; bi = i; }
        }
        if (bi < 0 || bd < 0.05) break;
        res.greeting.push(bi);
      }
    }
  }
  return res;
}

/** deterministic per-leaf autumn tint */
export function autumnTint(M: TreeModel, leaf: number): RGB {
  const a = M.species.colors.autumn;
  return a[Math.floor(M.leaves.r3[leaf] * a.length) % a.length];
}
/** per-leaf green */
export function leafGreen(M: TreeModel, leaf: number, fresh: number): RGB {
  const c = M.species.colors;
  const r = M.leaves.r3[leaf], ao = M.leaves.ao[leaf];
  let base = r < 0.33 ? c.light : r < 0.72 ? c.mid : c.dark;
  base = mixC(base, c.dark, clamp((1 - ao) * 0.35));
  return fresh > 0 ? mixC(base, mixC(c.light, [0.86, 0.9, 0.62], 0.35), fresh * 0.55 * (1 - hash1(leaf) * 0.5)) : base;
}
