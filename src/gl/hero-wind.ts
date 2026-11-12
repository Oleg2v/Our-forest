/* Hero "Crown": the photo on a WebGL plane, wind only in the foliage (painted mask), cursor gusts,
   seasonal particles with depth of field. A View of the single stage (src/gl/stage.ts). */
import {
  BufferAttribute, BufferGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, NormalBlending,
  OrthographicCamera, PlaneGeometry, Points, Scene, ShaderMaterial, Texture, TextureLoader, Vector2, Vector3, Vector4,
  type WebGLRenderer,
} from 'three';
import { getStage, type View } from './stage';
import { QUAD_VERT, WIND_FRAG, PARTICLE_VERT, PARTICLE_FRAG } from './shaders';
import type { HeroWindHandle, HeroWindOptions } from './types';

const SEASON: Record<string, { mode: 0 | 1; a: [number, number, number]; b: [number, number, number]; full: number; light: number }> = {
  spring: { mode: 0, a: [1.0, 0.86, 0.56], b: [1.0, 0.97, 0.86], full: 90, light: 34 },
  summer: { mode: 0, a: [1.0, 0.84, 0.55], b: [1.0, 0.95, 0.8], full: 56, light: 24 },
  // backlit in golden hour: sunlit olive-gold ↔ warm bark (the palette's olive / bark, lit)
  autumn: { mode: 1, a: [0.78, 0.7, 0.36], b: [0.62, 0.42, 0.24], full: 32, light: 14 },
  winter: { mode: 0, a: [0.86, 0.89, 0.8], b: [0.99, 0.97, 0.93], full: 40, light: 18 },
};

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

class HeroWind implements View {
  readonly priority = 1;
  readonly transient = false;
  readonly host: HTMLElement;
  private scene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: ShaderMaterial;
  private pmat: ShaderMaterial | null = null;
  private quad: Mesh;
  private points: Points | null = null;
  private tex: Texture;
  private mask: Texture;
  private visible = true;
  private disposed = false;
  private canvas: HTMLCanvasElement | null = null;
  private t = 0;
  private amp = 0;
  private ampTarget = 0;
  private ampDelay = 0;
  private gust = 0;
  private gustDir = new Vector2(-1, 0);
  private mouse = new Vector2(0.75, 0.6);
  private mouseTarget = new Vector2(0.75, 0.6);
  private mousePrev = new Vector2(0.75, 0.6);
  private moved = false;
  private tilt = new Vector2();
  private tiltTarget = new Vector2();
  private cap: number;
  private onDraw?: () => void;
  loop = false;

  constructor(o: HeroWindOptions, tex: Texture, mask: Texture) {
    this.host = o.host;
    this.cap = Math.min(2, o.dprCap);
    this.tex = tex; this.mask = mask;
    const img = o.img;
    this.onDraw = o.onFirstFrame;
    this.mat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: WIND_FRAG,
      depthTest: false, depthWrite: false,
      uniforms: {
        uTex: { value: tex },
        uMask: { value: mask },
        uRes: { value: new Vector2(1, 1) },
        uImg: { value: new Vector2(img.naturalWidth || 1, img.naturalHeight || 1) },
        uPos: { value: new Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uPeriod: { value: 28 },
        uK: { value: new Vector4(4, 7, 11, 5) },
        uAmp: { value: 0 },
        uQuality: { value: o.quality === 'full' ? 1 : 0 },
        uMouse: { value: this.mouse },
        uGustDir: { value: this.gustDir },
        uGust: { value: 0 },
      },
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    const conf = SEASON[o.season] ?? SEASON.spring;
    const count = o.particles === false ? 0 : (o.quality === 'full' ? conf.full : conf.light);
    if (count > 0) {
      const rnd = seeded(427 + count);
      const seeds = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        seeds[i * 4] = rnd(); seeds[i * 4 + 1] = rnd();
        // depth: most particles mid/far, a few close and big (bokeh)
        const d = rnd(); seeds[i * 4 + 2] = d < 0.12 ? 0.85 + rnd() * 0.15 : Math.pow(rnd(), 1.3) * 0.75;
        seeds[i * 4 + 3] = rnd();
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
      g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
      this.pmat = new ShaderMaterial({
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending,
        uniforms: {
          uTime: { value: 0 }, uPR: { value: 1 }, uScale: { value: 1 }, uMode: { value: conf.mode },
          uAmp: { value: 0 }, uRes: this.mat.uniforms.uRes, uMouse: { value: this.mouse },
          uGustDir: { value: this.gustDir }, uGust: this.mat.uniforms.uGust, uTilt: { value: this.tilt },
          uColA: { value: new Vector3(...conf.a) }, uColB: { value: new Vector3(...conf.b) },
        },
      });
      this.points = new Points(g, this.pmat);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }
  }

  /* ---------------------------------------------------------------- View */
  alive() { return !this.disposed && this.visible; }
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    canvas.classList.add('gl-stage--hero');
    if (canvas.parentElement !== this.host) this.host.appendChild(canvas);
  }
  detach() { this.canvas?.classList.remove('gl-stage--hero'); }
  size() { return { w: Math.max(2, this.host.clientWidth), h: Math.max(2, this.host.clientHeight) }; }
  dpr() { return Math.min(this.cap, window.devicePixelRatio || 1); }

  frame(r: WebGLRenderer, dt: number) {
    const u = this.mat.uniforms;
    this.t += dt;
    // wind arrives (intro) and settles; exponential smoothing = interruptible
    if (this.ampDelay > 0) this.ampDelay -= dt;
    else this.amp += (this.ampTarget - this.amp) * (1 - Math.exp(-dt / 0.75));
    // cursor gust: fast attack, slow smooth release
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-dt / 0.08));
    if (dt > 0) {
      const vx = (this.mouseTarget.x - this.mousePrev.x) / dt, vy = (this.mouseTarget.y - this.mousePrev.y) / dt;
      this.mousePrev.copy(this.mouseTarget);
      const sp = Math.hypot(vx, vy);
      if (this.moved && sp > 0.02) {
        const target = Math.min(1, sp * 0.32);
        if (target > this.gust) this.gust += (target - this.gust) * (1 - Math.exp(-dt / 0.09));
        const k = 1 - Math.exp(-dt / 0.18);
        this.gustDir.x += (vx / sp - this.gustDir.x) * k;
        this.gustDir.y += (vy / sp - this.gustDir.y) * k;
      }
      this.moved = false;
    }
    this.gust *= Math.exp(-dt / 0.85);
    this.tilt.lerp(this.tiltTarget, 1 - Math.exp(-dt / 0.25));

    const { w, h } = this.size();
    u.uRes.value.set(w, h);
    u.uTime.value = this.t;
    u.uAmp.value = this.amp;
    u.uGust.value = this.gust;
    if (this.pmat) {
      const p = this.pmat.uniforms;
      p.uTime.value = this.t;
      p.uPR.value = this.dpr();
      p.uScale.value = Math.min(1.35, Math.max(0.62, h / 900));
      p.uAmp.value = Math.min(1, this.amp * 1.15);
    }
    r.render(this.scene, this.cam);
    if (this.onDraw) { const f = this.onDraw; this.onDraw = undefined; f(); }
  }

  /* ---------------------------------------------------------------- handle */
  pointer(x: number, y: number) {
    if (!this.canvas) return;
    const b = this.canvas.getBoundingClientRect();
    if (!b.width || !b.height) return;
    this.mouseTarget.set((x - b.left) / b.width, 1 - (y - b.top) / b.height);
    this.moved = true;
    getStage().wake();
  }
  /** a touch "puff": a short gust at a point (phones have no hovering cursor) */
  puff(x: number, y: number) {
    if (!this.canvas) return;
    const b = this.canvas.getBoundingClientRect();
    if (!b.width || !b.height) return;
    this.mouse.set((x - b.left) / b.width, 1 - (y - b.top) / b.height);
    this.mouseTarget.copy(this.mouse); this.mousePrev.copy(this.mouse);
    this.gust = Math.max(this.gust, 0.75);
    this.gustDir.set(-0.95, 0.3);
    getStage().wake();
  }
  /** the wind arrives: amplitude ramps up with an opening gust travelling right → left */
  arrive(delay = 0) {
    this.ampTarget = 1;
    this.ampDelay = delay;
    this.gust = Math.max(this.gust, 0.55);
    this.gustDir.set(-1, 0.12);
    this.mouse.set(0.82, 0.62); this.mouseTarget.copy(this.mouse); this.mousePrev.copy(this.mouse);
    getStage().wake();
  }
  calm() { this.ampTarget = 0; }
  setVisible(v: boolean) { this.visible = v; if (v) getStage().wake(); }
  setTilt(x: number, y: number) { this.tiltTarget.set(x, y); getStage().wake(); }
  /** loop mode for the phone video render: periodic in uPeriod seconds, no particles, no gusts */
  setLoop(period: number) {
    this.loop = true;
    this.mat.uniforms.uPeriod.value = period;
    this.mat.uniforms.uK.value.set(1, 2, 3, 1);
    if (this.points) this.points.visible = false;
    this.amp = this.ampTarget = 1; this.gust = 0;
  }
  renderAt(r: WebGLRenderer, t: number) {
    this.t = t; this.amp = this.ampTarget = 1; this.gust = 0;
    this.frame(r, 0);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    getStage().remove(this);
    this.canvas?.remove();
    this.quad.geometry.dispose(); this.mat.dispose();
    this.points?.geometry.dispose(); this.pmat?.dispose();
    this.tex.dispose(); this.mask.dispose();
  }
}

/** A decoded copy of what an <img> currently shows, with its true pixel size. */
export async function cleanImage(src: HTMLImageElement): Promise<HTMLImageElement | null> {
  try {
    if (!src.complete || !src.naturalWidth) await src.decode();
    const url = src.currentSrc || src.src;
    if (!url) return null;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img.naturalWidth ? img : null;
  } catch { return null; }
}

/** Build the hero view. Resolves null if anything is missing (the photo stays as is). */
export async function createHeroWind(o: HeroWindOptions): Promise<HeroWindHandle | null> {
  // A DOM <img> with srcset reports a density-corrected naturalWidth (e.g. 1440 for a 1600w file on a 1440px
  // screen) — three would allocate the wrong storage. Re-decode the very same URL (memory cache, no network).
  const img = await cleanImage(o.img);
  if (!img) return null;
  const stage = getStage();
  if (stage.isLost) return null;
  const tex = new Texture(img);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  let mask: Texture;
  try {
    mask = await new TextureLoader().loadAsync(o.maskUrl);
    mask.minFilter = LinearFilter; mask.magFilter = LinearFilter; mask.generateMipmaps = false;
  } catch { tex.dispose(); return null; }
  const view = new HeroWind({ ...o, img }, tex, mask);
  stage.add(view);
  // compile + upload now (one hitch, at a moment the caller chose), so the first visible frame is smooth
  stage.renderNow(view);
  const handle: HeroWindHandle = {
    get canvas() { return stage.canvas; },
    pointer: (x, y) => view.pointer(x, y),
    puff: (x, y) => view.puff(x, y),
    arrive: (d) => view.arrive(d),
    calm: () => view.calm(),
    setVisible: (v) => view.setVisible(v),
    setTilt: (x, y) => view.setTilt(x, y),
    destroy: () => view.dispose(),
    __loop: (period: number) => view.setLoop(period),
    __renderAt: (t: number) => { stage.renderNow(view); view.renderAt(stage.renderer, t); },
  };
  return handle;
}
