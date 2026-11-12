/* ==========================================================================
   WebGL renderer (three.js) — "living botanical engraving".
   Lazy-loaded after the SVG twin is on screen. Same model, same projection (camera.ts),
   so the crossfade is seamless and a swap mid-sequence is invisible.
   Quality by tier: radial segments, hatching (tier ≥ 2), MSAA + crown shadow + grass (tier 3),
   DPR ≤ 2 (lower on phones), adaptive DPR if frames are slow. The driver pauses the loop when
   the tab is hidden or the scene is off screen.
   ========================================================================== */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, ShaderMaterial, BackSide, DoubleSide, FrontSide, Matrix4,
  CanvasTexture, WebGLRenderTarget, Vector2, Vector3, Vector4, InstancedBufferGeometry, InstancedBufferAttribute, NoColorSpace,
  LinearFilter, type IUniform, type BufferGeometry,
} from 'three';
import type { Frame, Renderer } from '../types';
import { ISLAND, PLAQUE, TOKEN, autumnTint, leafGreen, type TreeModel } from '../model';
import { P, TINT, mixC, clamp, lerp, type RGB } from '../util';
import {
  LIT_VERT, HULL_VERT, HULL_FRAG, BARK_FRAG, ROOT_FRAG, FILL_FRAG, EARTH_FRAG, CAP_FRAG, FACE_FRAG,
  LEAF_VERT, LEAF_FRAG, TUFT_VERT, TUFT_FRAG, PLAQUE_VERT, PLAQUE_FRAG, TOKEN_FRAG,
} from './shaders';
import {
  TubeBuffer, islandBody, islandCap, islandFace, makeInstancedLeaves, touchInstanced, fruitGeometry, plaqueGeometry,
  tokenGeometry, stickGeometry, seedGeometry, tuftGeometry, leafAtlas, type InstancedLeaves,
} from './geometry';

type U = Record<string, IUniform>;
const v3 = (c: RGB | number[]) => new Vector3(c[0], c[1], c[2]);

export function createGLRenderer(host: HTMLElement, model: TreeModel, quality: number, mobile: boolean, onLost: () => void): Renderer {
  return new GLRenderer(host, model, quality, mobile, onLost);
}

class GLRenderer implements Renderer {
  readonly kind = 'webgl' as const;
  readonly el: HTMLCanvasElement;
  private gl: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera();
  private island = new Group();
  private tree = new Group();
  private shared: U;
  private mats: ShaderMaterial[] = [];
  private model!: TreeModel;
  private q: number;
  private mobile: boolean;
  private radial: number;
  private w = 1; private h = 1; private dpr = 1; private dprCap = 2;
  private disposed = false;
  // meshes
  private body!: Mesh; private bodyHull!: Mesh; private cap!: Mesh; private face!: Mesh;
  private bark = new TubeBuffer(7); private barkMesh!: Mesh; private barkHull!: Mesh;
  private roots = new TubeBuffer(5); private rootMesh!: Mesh; private rootHull!: Mesh;
  private stubs = new TubeBuffer(6); private stubMesh!: Mesh; private stubHull!: Mesh;
  private leaves!: InstancedLeaves; private leafMesh!: Mesh;
  private loose!: InstancedLeaves; private looseMesh!: Mesh;   // fallen + falling (island space)
  private fruitGeo!: InstancedBufferGeometry; private fruitMesh!: Mesh; private fruitHull!: Mesh;
  private fruitBuf = { pos: new Float32Array(0), misc: new Float32Array(0), color: new Float32Array(0) };
  private tufts!: Mesh;
  private plaqueG = new Group(); private plaque!: Mesh; private plaqueHull!: Mesh;
  private sticksAbove: Mesh[] = []; private sticksBelow: Mesh[] = [];
  private token!: Mesh; private tokenHull!: Mesh;
  private seed!: Mesh; private seedHull!: Mesh;
  private plaqueTex: CanvasTexture | null = null; private plaqueVer = -1;
  private tokenTex: CanvasTexture | null = null;
  private atlas: CanvasTexture | null = null;
  private leafAspect: [number, number] = [1, 1];
  private growVer = -1; private seasonSig = ''; private looseSig = '';
  private frameTimes: number[] = [];
  private lastT = 0;
  private colors = { trunk: v3([0, 0, 0]) };
  private plaqueMatrix = new Matrix4();

  constructor(host: HTMLElement, model: TreeModel, quality: number, mobile: boolean, onLost: () => void) {
    this.q = Math.max(1, quality);
    this.mobile = mobile;
    this.radial = this.q >= 3 ? 8 : this.q === 2 ? (mobile ? 6 : 7) : 5;
    this.bark = new TubeBuffer(this.radial);
    this.roots = new TubeBuffer(Math.max(4, this.radial - 2));
    const canvas = document.createElement('canvas');
    canvas.className = 'ts-gl';
    canvas.setAttribute('aria-hidden', 'true');
    this.el = canvas;
    this.gl = new WebGLRenderer({
      canvas, alpha: true, premultipliedAlpha: true, antialias: this.q >= 3 && !mobile,
      powerPreference: 'high-performance', preserveDrawingBuffer: false, stencil: false,
    });
    this.gl.setClearColor(0x000000, 0);
    this.gl.outputColorSpace = 'srgb' as any;
    this.gl.sortObjects = true;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (!this.disposed) onLost(); }, { once: true });
    host.appendChild(canvas);
    this.dprCap = mobile ? (this.q >= 3 ? 2 : this.q === 2 ? 1.6 : 1.25) : 2;
    this.camera.matrixAutoUpdate = false;
    this.island.matrixAutoUpdate = false;
    this.tree.matrixAutoUpdate = false;
    this.scene.add(this.island);
    this.island.add(this.tree);
    this.shared = {
      uTime: { value: 0 }, uWind: { value: 0 }, uShake: { value: 0 }, uTreeH: { value: 1 },
      uLight: { value: new Vector3(0, 1, 0) }, uLightC: { value: new Vector3(1, 1, 1) }, uAmb: { value: 0.4 },
      uInk: { value: v3(P.bark) }, uInkA: { value: 1 }, uNight: { value: 0 }, uFill: { value: 1 },
      uHatch: { value: this.q >= 2 ? 1 : 0 }, uHatchO: { value: new Vector2() }, uDpr: { value: 1 }, uPaper: { value: v3(P.cream) },
      uRes: { value: new Vector2(1, 1) },
    };
    this.setModel(model);
  }

  /* ------------------------------------------------------------------ materials */
  private mat(vert: string, frag: string, own: U, opts: { side?: number; defines?: Record<string, string> } = {}) {
    const m = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { ...this.shared, ...own },
      side: (opts.side ?? FrontSide) as any,
      defines: opts.defines ?? {},
    });
    m.extensions = { ...(m.extensions || {}), derivatives: true } as any;
    this.mats.push(m);
    return m;
  }
  private hull(width: number, own: U = {}, defines?: Record<string, string>) {
    return this.mat(HULL_VERT, HULL_FRAG, {
      uLineW: { value: width }, uClipZ: { value: 99 }, uClipY: { value: -99 }, uClipYTop: { value: 99 }, uAlpha: { value: 1 },
      uSwingI: { value: -1 }, uSwingA: { value: 0 }, ...own,
    }, { side: BackSide, defines });
  }

  setModel(model: TreeModel) {
    this.model = model;
    // clear previous
    for (const m of this.mats) m.dispose();
    this.mats = [];
    this.island.clear();
    this.tree.clear();
    this.plaqueG.clear();
    this.island.add(this.tree);
    this.island.add(this.plaqueG);
    this.plaqueG.matrixAutoUpdate = false;
    this.growVer = -1; this.seasonSig = ''; this.looseSig = '';
    const M = model, I = M.island, sp = M.species;
    const seg = this.mobile ? 72 : 112;

    /* island */
    const earth = this.mat(LIT_VERT, EARTH_FRAG, {
      uColor: { value: v3(mixC(TINT.clay, P.bark, 0.15)) }, uColor2: { value: v3(mixC(TINT.clay, P.bark, 0.45)) },
      uClipZ: { value: ISLAND.ZC }, uWet: { value: 0 },
    });
    const bodyGeo = islandBody(I, seg, this.mobile ? 26 : 36);
    this.body = new Mesh(bodyGeo, earth);
    this.bodyHull = new Mesh(bodyGeo, this.hull(1.7, { uClipZ: { value: ISLAND.ZC + 0.001 } }));
    const capMat = this.mat(LIT_VERT, CAP_FRAG, {
      uColor: { value: v3(mixC(TINT.grass, P.cream, 0.38)) }, uWetC: { value: v3(mixC(TINT.humus, P.olive, 0.35)) },
      uShadow: { value: new Vector4(0, 0, 0.5, 0.3) }, uShadowA: { value: 0 }, uSpot: { value: 0 }, uWet: { value: 0 }, uZT: { value: ISLAND.ZT }, uRimR: { value: 1 },
    });
    this.cap = new Mesh(islandCap(I, seg), capMat);
    const faceMat = this.mat(LIT_VERT, FACE_FRAG, {
      uHumus: { value: v3(TINT.humus) }, uClay: { value: v3(TINT.clay) }, uStones: { value: v3(TINT.stones) }, uPebble: { value: v3(mixC(TINT.stones, P.cream, 0.45)) },
      uPh: { value: I.strataPhase.slice() }, uSpot: { value: 0 }, uSeep: { value: 0 }, uWet: { value: 0 }, uFaceBottom: { value: I.faceBottom },
      uSeed: { value: 0 }, uSeedY: { value: ISLAND.SEED_Y }, uLineW: { value: 1.6 },
    });
    this.face = new Mesh(islandFace(I), faceMat);
    this.island.add(this.body, this.bodyHull, this.cap, this.face);
    for (const m of [this.body, this.bodyHull, this.cap, this.face]) m.frustumCulled = false;

    /* tree: bark tubes */
    this.colors.trunk = v3(sp.colors.trunk);
    const barkMat = this.mat(LIT_VERT, BARK_FRAG, { uColor: { value: v3(sp.colors.trunk) }, uTwist: { value: sp.id === 'olive' ? 1.4 : 0.25 } });
    this.barkMesh = new Mesh(this.bark.geo, barkMat);
    this.barkHull = new Mesh(this.bark.geo, this.hull(1.25));
    const stubMat = this.mat(LIT_VERT, FILL_FRAG, { uColor: { value: v3(sp.colors.trunk) }, uClipY: { value: -99 }, uClipYTop: { value: 99 }, uCrack: { value: 0 }, uAlpha: { value: 1 }, uCutCap: { value: 1 }, uUseInstColor: { value: 0 } });
    this.stubMesh = new Mesh(this.stubs.geo, stubMat);
    this.stubHull = new Mesh(this.stubs.geo, this.hull(1.1));
    this.tree.add(this.barkMesh, this.barkHull, this.stubMesh, this.stubHull);
    /* roots (island space) */
    const rootMat = this.mat(LIT_VERT, ROOT_FRAG, { uColor: { value: v3(mixC(TINT.barkLight, P.bark, 0.18)) }, uGlow: { value: 0 }, uGlowA: { value: 0 } });
    this.rootMesh = new Mesh(this.roots.geo, rootMat);
    this.rootHull = new Mesh(this.roots.geo, this.hull(1.05));
    this.island.add(this.rootMesh, this.rootHull);

    /* leaves */
    this.atlas?.dispose();
    const at = leafAtlas(M);
    this.atlas = at.tex;
    this.leafAspect = at.aspect;
    const cap = M.leaves.count + (M.blossoms.count || 0) + 32;
    this.leaves = makeInstancedLeaves(cap);
    const leafMat = this.mat(LEAF_VERT, LEAF_FRAG, {
      uAtlas: { value: this.atlas }, uUnder: { value: v3(sp.colors.under) }, uGlowC: { value: v3(TINT.glow) }, uAlphaTest: { value: 0.42 },
      uLift: { value: 0 }, uCrownC: { value: new Vector3(...M.crownC) },
    }, { side: DoubleSide });
    this.leafMesh = new Mesh(this.leaves.geo, leafMat);
    this.loose = makeInstancedLeaves(96);
    this.looseMesh = new Mesh(this.loose.geo, leafMat);
    this.tree.add(this.leafMesh);
    this.island.add(this.looseMesh);

    /* fruits */
    const fg = fruitGeometry(sp.fruit.shape);
    const fi = new InstancedBufferGeometry();
    fi.index = fg.index;
    for (const n of ['position', 'normal', 'aSway']) fi.setAttribute(n, fg.getAttribute(n));
    const fc = Math.max(1, M.fruits.count);
    this.fruitBuf = { pos: new Float32Array(fc * 3), misc: new Float32Array(fc * 4), color: new Float32Array(fc * 3) };
    fi.setAttribute('iPos', new InstancedBufferAttribute(this.fruitBuf.pos, 3));
    fi.setAttribute('iMisc', new InstancedBufferAttribute(this.fruitBuf.misc, 4));
    fi.setAttribute('iColor', new InstancedBufferAttribute(this.fruitBuf.color, 3));
    fi.instanceCount = 0;
    this.fruitGeo = fi;
    const fruitMat = this.mat(LIT_VERT, FILL_FRAG, {
      uColor: { value: v3(sp.fruit.color) }, uClipY: { value: -99 }, uClipYTop: { value: 99 }, uCrack: { value: 0 }, uAlpha: { value: 1 }, uCutCap: { value: 0 },
      uUseInstColor: { value: 1 }, uSwingI: { value: -1 }, uSwingA: { value: 0 },
    }, { defines: { INSTANCED: '' } });
    this.fruitMesh = new Mesh(fi, fruitMat);
    this.fruitHull = new Mesh(fi, this.hull(1.1, {}, { INSTANCED: '' }));
    this.tree.add(this.fruitMesh, this.fruitHull);

    /* grass tufts */
    if (this.q >= 2) {
      const tg = tuftGeometry();
      const ti = new InstancedBufferGeometry();
      ti.index = tg.index;
      ti.setAttribute('position', tg.getAttribute('position'));
      const step = this.mobile ? 2 : 1;
      const list = I.tufts.filter((_, i) => i % step === 0);
      const arr = new Float32Array(list.length * 4);
      list.forEach((t, i) => { arr[i * 4] = t.x; arr[i * 4 + 1] = t.z; arr[i * 4 + 2] = t.s * 0.8; arr[i * 4 + 3] = t.lean; });
      ti.setAttribute('iTuft', new InstancedBufferAttribute(arr, 4));
      ti.instanceCount = list.length;
      const tm = this.mat(TUFT_VERT, TUFT_FRAG, { uAtlas: { value: this.atlas }, uCamRight: { value: new Vector3(1, 0, 0) } }, { side: DoubleSide });
      this.tufts = new Mesh(ti, tm);
      this.island.add(this.tufts);
    }

    /* plaque + token + stakes */
    const pg = plaqueGeometry();
    const plaqueMat = this.mat(PLAQUE_VERT, PLAQUE_FRAG, {
      uMap: { value: null }, uColor: { value: v3(mixC(P.bark, P.sand, 0.35)) }, uBox: { value: new Vector4(pg.box[0], pg.box[1], pg.box[2], pg.box[3]) },
      uClipY: { value: -99 }, uClipYTop: { value: 99 }, uWorldClip: { value: -99 }, uIslandFromLocal: { value: this.plaqueMatrix },
    });
    this.plaque = new Mesh(pg.geo, plaqueMat);
    this.plaqueHull = new Mesh(pg.geo, this.hull(1.3));
    this.plaqueG.add(this.plaque, this.plaqueHull);
    const wood = v3(mixC(P.bark, P.soil, 0.25));
    const stick = (above: boolean, x: number, w: number, d: number, z: number, y0: number, y1: number) => {
      const g = stickGeometry(w, y1 - y0, d, y0);
      const m = new Mesh(g, this.mat(LIT_VERT, FILL_FRAG, { uColor: { value: wood }, uClipY: { value: -99 }, uClipYTop: { value: 99 }, uCrack: { value: 0 }, uAlpha: { value: 1 }, uCutCap: { value: 0 }, uUseInstColor: { value: 0 } }));
      const hm = new Mesh(g, this.hull(1.0));
      for (const mm of [m, hm]) { mm.position.set(x, 0, z); mm.matrixAutoUpdate = true; this.island.add(mm); }
      (above ? this.sticksAbove : this.sticksBelow).push(m, hm);
    };
    this.sticksAbove = []; this.sticksBelow = [];
    for (const sx of [-0.13, 0.13]) {
      stick(true, PLAQUE.x + sx, 0.02, 0.014, PLAQUE.z - 0.004, -0.01, PLAQUE.y - PLAQUE.h * 0.3);
      stick(false, PLAQUE.x + sx, 0.02, 0.012, ISLAND.ZC + 0.006, -0.2, 0.0);
    }
    stick(true, TOKEN.x, 0.009, 0.009, TOKEN.z - 0.008, -0.01, TOKEN.y);
    stick(false, TOKEN.x, 0.009, 0.009, ISLAND.ZC + 0.006, -0.12, 0.0);
    const tokMat = this.mat(LIT_VERT, TOKEN_FRAG, { uMap: { value: null }, uColor: { value: v3(TINT.brass) }, uR: { value: TOKEN.r } });
    const tg = tokenGeometry(TOKEN.r);
    this.token = new Mesh(tg, tokMat);
    this.tokenHull = new Mesh(tg, this.hull(1.1));
    for (const m of [this.token, this.tokenHull]) { m.position.set(TOKEN.x, TOKEN.y, TOKEN.z); this.island.add(m); }

    /* seed */
    const sg = seedGeometry();
    const seedMat = this.mat(LIT_VERT, FILL_FRAG, { uColor: { value: v3(mixC(TINT.barkLight, P.sand, 0.25)) }, uClipY: { value: -99 }, uClipYTop: { value: 99 }, uCrack: { value: 0 }, uAlpha: { value: 1 }, uCutCap: { value: 0 }, uUseInstColor: { value: 0 } });
    this.seed = new Mesh(sg, seedMat);
    this.seedHull = new Mesh(sg, this.hull(1.3));
    for (const m of [this.seed, this.seedHull]) { m.position.set(0, ISLAND.SEED_Y, ISLAND.ZC + 0.016); m.scale.set(0.034, 0.023, 0.02); this.island.add(m); }

    for (const o of [this.barkMesh, this.barkHull, this.rootMesh, this.rootHull, this.leafMesh, this.looseMesh, this.fruitMesh, this.fruitHull, this.stubMesh, this.stubHull]) o.frustumCulled = false;
    if (this.tufts) this.tufts.frustumCulled = false;
    this.plaqueVer = -1;
  }

  /** device tier changed after start (detect-gpu resolves late): hatching + DPR follow; geometry detail stays */
  setQuality(q: number) {
    this.q = Math.max(1, q);
    this.shared.uHatch.value = this.q >= 2 ? 1 : 0;
    this.dprCap = this.mobile ? (this.q >= 3 ? 2 : this.q === 2 ? 1.6 : 1.25) : 2;
    this.resize(this.w, this.h, window.devicePixelRatio || 1);
  }

  async init(f: Frame) {
    this.resize(f.w, f.h, f.dpr);
    this.render(f);
    // parallel, non-blocking shader compilation where supported (KHR_parallel_shader_compile)
    try {
      const parallel = this.gl.extensions.has('KHR_parallel_shader_compile');
      if (parallel && (this.gl as any).compileAsync) await (this.gl as any).compileAsync(this.scene, this.camera);
      else this.gl.compile(this.scene, this.camera);
    } catch { /* ignore */ }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    this.render(f);
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h;
    this.dpr = Math.min(dpr, this.dprCap);
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(w, h, false);
    this.el.style.width = '100%'; this.el.style.height = '100%';
  }

  /* ------------------------------------------------------------------ per frame */
  render(f: Frame) {
    if (this.disposed) return;
    if (f.model !== this.model) this.setModel(f.model);
    const now = performance.now();
    if (this.lastT) this.adapt(now - this.lastT);
    this.lastT = now;
    this.updateCamera(f, this.w, this.h, this.dpr);
    this.updateUniforms(f);
    this.updateGrowth(f);
    this.updateLoose(f);
    this.updatePlaque(f);
    this.gl.render(this.scene, this.camera);
  }

  private adapt(dt: number) {
    if (dt > 200) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 24 && this.dpr > 1.01) {
      this.dprCap = Math.max(1, this.dpr - 0.25);
      this.resize(this.w, this.h, this.dprCap);
    }
  }

  private updateCamera(f: Frame, w: number, h: number, dpr: number) {
    const p = f.proj;
    const view = this.camera.matrixWorldInverse;
    p.viewMatrix(view.elements);
    this.camera.matrixWorld.copy(view).invert();
    const near = 0.05, far = 60;
    const [l, r, t, b] = p.frustum(near);
    this.camera.projectionMatrix.makePerspective(l, r, t, b, near, far);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    p.islandMatrix(this.island.matrix.elements);
    this.island.matrixWorldNeedsUpdate = true;
    const s = f.a.breathe;
    this.tree.matrix.makeScale(s, s, s).setPosition(0, 0, ISLAND.ZT);
    this.tree.matrixWorldNeedsUpdate = true;
    const u = this.shared;
    (u.uRes.value as Vector2).set(w * dpr, h * dpr);
    u.uDpr.value = dpr;
    // hatching anchored to the island (moves with it, does not swim with the float)
    const o = p.island(0, 0, ISLAND.ZT, [0, 0, 0]);
    (u.uHatchO.value as Vector2).set(o[0] * dpr, (h - o[1]) * dpr);
  }

  private updateUniforms(f: Frame) {
    const u = this.shared, L = f.look, a = f.a;
    u.uTime.value = f.time;
    u.uWind.value = a.wind;
    u.uShake.value = a.shake;
    u.uTreeH.value = Math.max(0.3, f.grow.top);
    (u.uLight.value as Vector3).set(L.light[0], L.light[1], L.light[2]);
    (u.uLightC.value as Vector3).set(L.lightC[0], L.lightC[1], L.lightC[2]);
    u.uAmb.value = L.amb;
    const ink = mixC(L.bg, L.ink, L.inkA);
    (u.uInk.value as Vector3).set(ink[0], ink[1], ink[2]);
    u.uInkA.value = 1;
    u.uNight.value = L.night;
    u.uFill.value = L.fill * (f.state.mode === 'memorial' ? 0.97 : 1);
    (u.uPaper.value as Vector3).set(L.bg[0], L.bg[1], L.bg[2]);
    // island materials
    const wet = a.wet;
    (this.body.material as ShaderMaterial).uniforms.uWet.value = wet;
    const cm = (this.cap.material as ShaderMaterial).uniforms;
    cm.uSpot.value = a.spot; cm.uWet.value = wet;
    // crown shadow on the cap (strong devices)
    const G = f.grow;
    if (this.q >= 3 && f.state.planted && G.leafCount + G.chains.length > 0) {
      const sx = -L.light[0] / Math.max(0.25, L.light[1]) * 0.35 * L.shadowLen;
      const cr = Math.min(0.95, G.crownR * 0.9 + 0.08);
      (cm.uShadow.value as Vector4).set(G.crownC[0] + sx, ISLAND.ZT - 0.04, cr * (1 + Math.abs(sx) * 0.4), cr * 0.55);
      cm.uShadowA.value = L.shadowA * 0.8 * clamp(G.leafCount / 60 + 0.25);
    } else cm.uShadowA.value = 0;
    const fm = (this.face.material as ShaderMaterial).uniforms;
    fm.uSpot.value = a.spot; fm.uSeep.value = a.seep; fm.uWet.value = wet; fm.uSeed.value = a.seed;
    const rm = (this.rootMesh.material as ShaderMaterial).uniforms;
    rm.uGlow.value = a.rootGlow; rm.uGlowA.value = a.rootGlowA;
    const lm = (this.leafMesh.material as ShaderMaterial).uniforms;
    lm.uLift.value = a.lift;
    const fr = (this.fruitMesh.material as ShaderMaterial).uniforms;
    fr.uSwingI.value = a.fruitSwing >= 0 ? this.fruitIndexOf(a.fruitSwing) : -1; fr.uSwingA.value = a.fruitSwingA;
    const fh = (this.fruitHull.material as ShaderMaterial).uniforms;
    fh.uSwingI.value = fr.uSwingI.value; fh.uSwingA.value = a.fruitSwingA;
    // seed
    const seedOn = a.seed > 0.01;
    this.seed.visible = this.seedHull.visible = seedOn;
    if (seedOn) {
      const pulse = 1 + (f.motion ? 0.05 * Math.sin(f.time * 2.6) * (f.state.planted ? 0 : 1) : 0) + a.seedPulse * 0.07;
      const crackJolt = 1 + Math.max(0, Math.sin((a.crack % 1) * Math.PI)) * 0.03;
      for (const m of [this.seed, this.seedHull]) m.scale.set(0.034 * pulse * crackJolt, 0.023 * pulse, 0.02 * pulse);
      const sm = (this.seed.material as ShaderMaterial).uniforms;
      sm.uCrack.value = a.crack; sm.uAlpha.value = clamp(a.seed);
      (this.seedHull.material as ShaderMaterial).uniforms.uAlpha.value = clamp(a.seed * 1.4 - 0.4);
    }
    // camera right in island space for the tufts
    if (this.tufts) {
      const yaw = f.proj.xf.yaw;
      ((this.tufts.material as ShaderMaterial).uniforms.uCamRight.value as Vector3).set(Math.cos(yaw), 0, Math.sin(yaw));
    }
    (this.leafMesh.material as ShaderMaterial).uniforms.uCrownC.value.set(G.crownC[0], G.crownC[1], G.crownC[2]);
  }

  private fruitOrder: number[] = [];
  private fruitIndexOf(modelFruit: number) { return this.fruitOrder.indexOf(modelFruit); }

  /* ------------------------------------------------------------------ growth-dependent buffers */
  private updateGrowth(f: Frame) {
    const G = f.grow, M = this.model, s = G.s, st = f.state;
    const seasonSig = `${Math.round(f.season.fresh * 20)}|${f.greetLeaves.join(',')}|${st.greetings.map((g) => g.glowing ? 1 : 0).join('')}|${Math.round(f.a.prune * 4)}|${st.freshPrune}`;
    if (G.version === this.growVer && seasonSig === this.seasonSig) return;
    this.growVer = G.version; this.seasonSig = seasonSig;
    const planted = st.planted;
    /* bark */
    this.barkMesh.visible = this.barkHull.visible = planted && G.chains.length > 0;
    if (planted && G.chains.length) {
      const chains = G.chains.filter((c) => c.length >= 2);
      this.bark.build(chains, (i) => [G.x[i], G.y[i], G.z[i]], (i) => Math.max(0.0016, G.r[i]),
        (i) => [M.phase[i], M.flex[i], 1, 0], 0.55);
      this.barkMesh.geometry = this.bark.geo; this.barkHull.geometry = this.bark.geo;
    }
    /* fresh cuts */
    const cuts: number[][] = [];
    const cutPts: Record<number, [number, number, number][]> = {};
    if (planted && f.a.prune > 0.3) {
      M.pruneSites.forEach((ps, k) => {
        if (!G.vis[ps.node]) return;
        const i = ps.node, rr = G.r[i] * 0.75;
        cutPts[k] = [[G.x[i], G.y[i], G.z[i]], [G.x[i] + ps.dir[0] * rr * 2.4, G.y[i] + ps.dir[1] * rr * 2.4, G.z[i] + ps.dir[2] * rr * 2.4]];
        cuts.push([k * 2, k * 2 + 1]);
      });
    }
    this.stubMesh.visible = this.stubHull.visible = cuts.length > 0;
    if (cuts.length) {
      this.stubs.build(cuts, (i) => cutPts[Math.floor(i / 2)][i % 2], (i) => Math.max(0.003, G.r[M.pruneSites[Math.floor(i / 2)].node] * 0.75),
        (i) => [M.phase[M.pruneSites[Math.floor(i / 2)].node], 0.4, 1, i % 2], 1.0);
      this.stubMesh.geometry = this.stubs.geo; this.stubHull.geometry = this.stubs.geo;
    }
    /* roots (in the cut) */
    const R = M.rootsys;
    const rev = G.rootReveal * R.mMax;
    const rchains: number[][] = [];
    const extraPt = new Map<number, [number, number]>();
    if (planted && rev > 0) {
      let fake = -1;
      for (const ch of R.chains) {
        const part: number[] = [];
        for (let k = 0; k < ch.length; k++) {
          const i = ch[k];
          if (R.m[i] > rev) {
            if (k > 0) {
              const p = ch[k - 1];
              const fr = clamp((rev - R.m[p]) / Math.max(1e-4, R.m[i] - R.m[p]));
              if (fr > 0.02) { extraPt.set(fake, [lerp(R.x[p], R.x[i], fr), lerp(R.y[p], R.y[i], fr)]); part.push(fake--); }
            }
            break;
          }
          part.push(i);
        }
        if (part.length >= 2) rchains.push(part);
      }
    }
    this.rootMesh.visible = this.rootHull.visible = rchains.length > 0;
    if (rchains.length) {
      const rw = G.rootW;
      const zc = ISLAND.ZC + 0.003;
      const pt = (i: number): [number, number] => (i < 0 ? extraPt.get(i)! : [R.x[i], R.y[i]]);
      const rad = (i: number, k: number) => {
        if (i < 0) return 0.004;
        return Math.max(0.0035, R.w[i] * rw);
      };
      this.roots.build(rchains, (i) => { const p = pt(i); const r = i < 0 ? 0.004 : Math.max(0.0035, R.w[i] * rw); return [p[0], p[1], zc - r * 0.2]; }, rad,
        (i) => [0, 0, 0, i < 0 ? 1 : R.d[i] / R.dMax], 0.6);
      this.rootMesh.geometry = this.roots.geo; this.rootHull.geometry = this.roots.geo;
    }
    /* leaves + blossoms + seedling leaves */
    const Lf = this.leaves, L = M.leaves;
    let c = 0;
    const greet = new Map<number, boolean>();
    f.greetLeaves.forEach((li, gi) => { const g = st.greetings[gi]; if (g) greet.set(li, g.glowing); });
    const fresh = f.season.fresh;
    const cell = 0;
    for (let k = 0; k < G.leafCount && c < Lf.cap - 4; k++) {
      const li = G.leaves[k];
      const isG = greet.has(li);
      const glow = isG && greet.get(li) ? 1 : 0;
      const len = L.size[li] * G.leafScale[k] * (isG ? 1.35 : 1);
      Lf.pos[c * 3] = L.x[li] * s; Lf.pos[c * 3 + 1] = L.y[li] * s; Lf.pos[c * 3 + 2] = L.z[li] * s;
      Lf.dir[c * 3] = L.dx[li]; Lf.dir[c * 3 + 1] = L.dy[li]; Lf.dir[c * 3 + 2] = L.dz[li];
      Lf.nrm[c * 3] = L.nx[li]; Lf.nrm[c * 3 + 1] = L.ny[li]; Lf.nrm[c * 3 + 2] = L.nz[li];
      Lf.size[c * 4] = len; Lf.size[c * 4 + 1] = len * this.leafAspect[0]; Lf.size[c * 4 + 2] = cell; Lf.size[c * 4 + 3] = glow;
      const ni = L.node[li];
      Lf.misc[c * 4] = M.phase[ni] + L.r1[li] * 3; Lf.misc[c * 4 + 1] = 0.6 + M.flex[ni] * 0.6; Lf.misc[c * 4 + 2] = 0.55 + 0.45 * L.ao[li]; Lf.misc[c * 4 + 3] = 0;
      let col: RGB = G.leafAutumn[k] > 0.5 ? autumnTint(M, li) : leafGreen(M, li, fresh);
      if (isG && !glow) col = mixC(col, TINT.glow, 0.35);
      Lf.color[c * 3] = col[0]; Lf.color[c * 3 + 1] = col[1]; Lf.color[c * 3 + 2] = col[2];
      c++;
    }
    const BL = M.blossoms, bloom = M.species.bloom;
    if (bloom) for (let k = 0; k < G.blossomCount && c < Lf.cap - 4; k++) {
      const i = G.blossoms[k];
      const len = BL.size[i] * G.blossomScale[k] * (bloom.bell ? 1.1 : 1.25);
      Lf.pos[c * 3] = G.blossomXYZ[k * 3]; Lf.pos[c * 3 + 1] = G.blossomXYZ[k * 3 + 1]; Lf.pos[c * 3 + 2] = G.blossomXYZ[k * 3 + 2];
      const a = BL.rot[i] * 3;
      Lf.dir[c * 3] = Math.sin(a) * 0.4; Lf.dir[c * 3 + 1] = 1; Lf.dir[c * 3 + 2] = Math.cos(a) * 0.2;
      Lf.nrm[c * 3] = 0; Lf.nrm[c * 3 + 1] = -0.2; Lf.nrm[c * 3 + 2] = 1;
      Lf.size[c * 4] = len; Lf.size[c * 4 + 1] = len; Lf.size[c * 4 + 2] = 2; Lf.size[c * 4 + 3] = 0;
      Lf.misc[c * 4] = M.phase[BL.node[i]]; Lf.misc[c * 4 + 1] = 0.8; Lf.misc[c * 4 + 2] = 0.9; Lf.misc[c * 4 + 3] = 0;
      const bc = bloom.color;
      Lf.color[c * 3] = bc[0]; Lf.color[c * 3 + 1] = bc[1]; Lf.color[c * 3 + 2] = bc[2];
      c++;
    }
    if (G.cotyledon) {
      const co = G.cotyledon;
      for (const side of [-1, 1]) {
        const ang = side * lerp(0.15, 1.08, co.open);
        Lf.pos[c * 3] = co.x; Lf.pos[c * 3 + 1] = co.y; Lf.pos[c * 3 + 2] = co.z;
        Lf.dir[c * 3] = Math.sin(ang); Lf.dir[c * 3 + 1] = Math.cos(ang); Lf.dir[c * 3 + 2] = 0.12;
        Lf.nrm[c * 3] = -Math.cos(ang) * 0.3 * side; Lf.nrm[c * 3 + 1] = 0.35; Lf.nrm[c * 3 + 2] = 1;
        const len = co.size * lerp(0.6, 1, co.open);
        Lf.size[c * 4] = len; Lf.size[c * 4 + 1] = len * this.leafAspect[1]; Lf.size[c * 4 + 2] = 1; Lf.size[c * 4 + 3] = 0;
        Lf.misc[c * 4] = 0; Lf.misc[c * 4 + 1] = 0.3; Lf.misc[c * 4 + 2] = 0.9; Lf.misc[c * 4 + 3] = 0;
        const g = M.species.colors.light;
        Lf.color[c * 3] = g[0]; Lf.color[c * 3 + 1] = g[1]; Lf.color[c * 3 + 2] = g[2];
        c++;
      }
    }
    Lf.geo.instanceCount = planted ? c : 0;
    touchInstanced(Lf.geo, ['iPos', 'iDir', 'iNrm', 'iSize', 'iMisc', 'iColor']);
    /* fruits */
    const FR = M.fruits;
    let fc = 0;
    this.fruitOrder = [];
    const muted = st.mode === 'memorial' ? 0.25 : 0;
    for (let k = 0; k < G.fruitCount; k++) {
      const i = G.fruits[k];
      const sc = FR.size[i] * G.fruitScale[k];
      if (sc < 0.004) continue;
      this.fruitOrder.push(i);
      this.fruitBuf.pos[fc * 3] = G.fruitXYZ[k * 3]; this.fruitBuf.pos[fc * 3 + 1] = G.fruitXYZ[k * 3 + 1] + sc * 0.5; this.fruitBuf.pos[fc * 3 + 2] = G.fruitXYZ[k * 3 + 2];
      this.fruitBuf.misc[fc * 4] = sc; this.fruitBuf.misc[fc * 4 + 1] = M.phase[FR.node[i]]; this.fruitBuf.misc[fc * 4 + 2] = 0.9; this.fruitBuf.misc[fc * 4 + 3] = FR.rot[i];
      const col = mixC(M.species.fruit.color, P.sand, muted);
      this.fruitBuf.color[fc * 3] = col[0]; this.fruitBuf.color[fc * 3 + 1] = col[1]; this.fruitBuf.color[fc * 3 + 2] = col[2];
      fc++;
    }
    this.fruitGeo.instanceCount = planted ? fc : 0;
    touchInstanced(this.fruitGeo, ['iPos', 'iMisc', 'iColor']);
  }

  /** fallen leaves lying on the island + falling leaves (island space, no sway) */
  private updateLoose(f: Frame) {
    const Lf = this.loose, M = this.model, I = M.island, G = f.grow;
    const fallenN = !M.species.evergreen && f.state.planted && f.season.autumn > 0.3 && G.g > 0.1
      ? Math.round(I.fallen.length * clamp(f.season.autumn) * (f.state.season === 'winter' ? 0.8 : 0.6)) : 0;
    const sig = `${fallenN}|${f.falling.length}`;
    if (!f.falling.length && sig === this.looseSig) return;
    this.looseSig = sig;
    let c = 0;
    const base = M.species.leaf.len * Math.pow(G.s, 0.45) * (M.species.leaf.shape === 'fig' ? 0.75 : 1);
    for (let i = 0; i < fallenN && c < Lf.cap; i++) {
      const fl = I.fallen[i];
      const len = base * fl.s;
      Lf.pos[c * 3] = fl.x - Math.cos(fl.rot) * len * 0.5; Lf.pos[c * 3 + 1] = 0.004; Lf.pos[c * 3 + 2] = fl.z - Math.sin(fl.rot) * len * 0.5;
      Lf.dir[c * 3] = Math.cos(fl.rot); Lf.dir[c * 3 + 1] = 0; Lf.dir[c * 3 + 2] = Math.sin(fl.rot);
      Lf.nrm[c * 3] = 0; Lf.nrm[c * 3 + 1] = 1; Lf.nrm[c * 3 + 2] = 0;
      Lf.size[c * 4] = len; Lf.size[c * 4 + 1] = len * this.leafAspect[0]; Lf.size[c * 4 + 2] = 0; Lf.size[c * 4 + 3] = 0;
      Lf.misc[c * 4] = 0; Lf.misc[c * 4 + 1] = 0; Lf.misc[c * 4 + 2] = 0.8; Lf.misc[c * 4 + 3] = 1;
      const col = M.species.colors.autumn[Math.floor(fl.c * M.species.colors.autumn.length) % M.species.colors.autumn.length];
      const cc = mixC(col, P.bark, 0.15);
      Lf.color[c * 3] = cc[0]; Lf.color[c * 3 + 1] = cc[1]; Lf.color[c * 3 + 2] = cc[2];
      c++;
    }
    for (const p of f.falling) {
      if (c >= Lf.cap || p.alpha < 0.05) continue;
      const fl = p.landed >= 0;
      const ca = Math.cos(p.rot), sa = Math.sin(p.rot);
      Lf.pos[c * 3] = p.x; Lf.pos[c * 3 + 1] = p.y; Lf.pos[c * 3 + 2] = p.z;
      if (fl) { Lf.dir[c * 3] = ca; Lf.dir[c * 3 + 1] = 0; Lf.dir[c * 3 + 2] = sa; Lf.nrm[c * 3] = 0; Lf.nrm[c * 3 + 1] = 1; Lf.nrm[c * 3 + 2] = 0; }
      else {
        Lf.dir[c * 3] = ca; Lf.dir[c * 3 + 1] = sa * 0.6; Lf.dir[c * 3 + 2] = Math.sin(p.tilt) * 0.5;
        Lf.nrm[c * 3] = -sa * 0.3; Lf.nrm[c * 3 + 1] = Math.cos(p.tilt); Lf.nrm[c * 3 + 2] = Math.sin(p.tilt + 1.2);
      }
      const len = p.size * clamp(p.alpha * 1.4);
      Lf.size[c * 4] = len; Lf.size[c * 4 + 1] = len * (p.petal ? 1 : this.leafAspect[0]); Lf.size[c * 4 + 2] = p.petal ? 2 : 0; Lf.size[c * 4 + 3] = 0;
      Lf.misc[c * 4] = 0; Lf.misc[c * 4 + 1] = 0; Lf.misc[c * 4 + 2] = 0.85; Lf.misc[c * 4 + 3] = 1;
      Lf.color[c * 3] = p.color[0]; Lf.color[c * 3 + 1] = p.color[1]; Lf.color[c * 3 + 2] = p.color[2];
      c++;
    }
    Lf.geo.instanceCount = c;
    touchInstanced(Lf.geo, ['iPos', 'iDir', 'iNrm', 'iSize', 'iMisc', 'iColor']);
  }

  private updatePlaque(f: Frame) {
    const a = f.a;
    // texture (the engraver's canvas) — re-uploaded only when it changed
    if (!this.plaqueTex) {
      this.plaqueTex = new CanvasTexture(f.plaque.canvas);
      this.plaqueTex.colorSpace = NoColorSpace;
      this.plaqueTex.anisotropy = 4;
      (this.plaque.material as ShaderMaterial).uniforms.uMap.value = this.plaqueTex;
    }
    if (f.plaque.version !== this.plaqueVer) { this.plaqueTex.needsUpdate = true; this.plaqueVer = f.plaque.version; }
    if (!this.tokenTex) {
      this.tokenTex = new CanvasTexture(f.token);
      this.tokenTex.colorSpace = NoColorSpace;
      this.tokenTex.minFilter = LinearFilter;
      (this.token.material as ShaderMaterial).uniforms.uMap.value = this.tokenTex;
    }
    const visible = (f.state.planted || a.plaqueRise > 0.01) && a.plaqueRise > 0.005;
    const lift = PLAQUE.y + PLAQUE.h * 0.6 + 0.02;
    const dy = -(1 - clamp(a.plaqueRise)) * lift;
    const rising = a.plaqueRise < 0.999;
    // plaque group: translate · yaw · tilt
    const m = this.plaqueG.matrix;
    m.makeRotationX(PLAQUE.tilt);
    const ry = new Matrix4().makeRotationY(PLAQUE.yaw);
    m.premultiply(ry);
    m.setPosition(PLAQUE.x, PLAQUE.y + dy, PLAQUE.z);
    this.plaqueG.matrixWorldNeedsUpdate = true;
    this.plaqueMatrix.copy(m);
    const pm = (this.plaque.material as ShaderMaterial).uniforms;
    pm.uWorldClip.value = rising ? 0 : -99;
    this.plaqueG.visible = visible;
    (this.plaqueHull.material as ShaderMaterial).uniforms.uClipY.value = -99;
    // hull of the plaque cannot be clipped in island space cheaply: hide it while rising below ground
    this.plaqueHull.visible = !rising || a.plaqueRise > 0.92;
    for (let k = 0; k < this.sticksAbove.length; k++) {
      const mm = this.sticksAbove[k];
      mm.position.y = dy; mm.visible = visible;
      const u = (mm.material as ShaderMaterial).uniforms;
      u.uClipY.value = rising ? -dy : -99;
    }
    for (const mm of this.sticksBelow) {
      mm.position.y = dy; mm.visible = visible;
      (mm.material as ShaderMaterial).uniforms.uClipYTop.value = -dy;
    }
    for (const mm of [this.token, this.tokenHull]) { mm.position.y = TOKEN.y + dy; mm.visible = visible && (!rising || TOKEN.y + dy > 0.03); }
  }

  /* ------------------------------------------------------------------ snapshot */
  async snapshot(f: Frame, w: number, h: number): Promise<HTMLCanvasElement | null> {
    const rt = new WebGLRenderTarget(w, h, { depthBuffer: true, samples: this.q >= 3 ? 4 : 0 });
    const prevSize = { w: this.w, h: this.h, dpr: this.dpr };
    this.updateCamera(f, w, h, 1);
    this.updateUniforms(f);
    this.updateGrowth(f);
    this.gl.setRenderTarget(rt);
    this.gl.setClearColor(0x000000, 0);
    this.gl.clear();
    this.gl.render(this.scene, this.camera);
    const buf = new Uint8Array(w * h * 4);
    this.gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    this.gl.setRenderTarget(null);
    rt.dispose();
    this.updateCamera(f, prevSize.w, prevSize.h, prevSize.dpr);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    // flip Y and un-premultiply
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      for (let x = 0; x < w * 4; x += 4) {
        const al = buf[src + x + 3];
        const k = al > 0 ? 255 / al : 0;
        img.data[dst + x] = Math.min(255, buf[src + x] * k);
        img.data[dst + x + 1] = Math.min(255, buf[src + x + 1] * k);
        img.data[dst + x + 2] = Math.min(255, buf[src + x + 2] * k);
        img.data[dst + x + 3] = al;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const m of this.mats) m.dispose();
    this.scene.traverse((o) => { const g = (o as Mesh).geometry as BufferGeometry | undefined; g?.dispose?.(); });
    this.bark.dispose(); this.roots.dispose(); this.stubs.dispose();
    this.atlas?.dispose(); this.plaqueTex?.dispose(); this.tokenTex?.dispose();
    this.gl.dispose();
    try { this.gl.forceContextLoss(); } catch { /* ignore */ }
    this.el.remove();
  }
}
