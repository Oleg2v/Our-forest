/* ==========================================================================
   /tree/0427 — the living tree scene ("living botanical engraving").
   Implements the TreeScene contract (../scene-api.ts).

   One driver, two renderers:
   • this file owns the state, the model, every animation value, the sequences (birth, visit,
     watering, shake, focus), gestures, hotspots, the shared camera, and the shared layers
     (paper/light background, overlay, fx, fog);
   • the SVG renderer (./svg) draws first — fast LCP, also the full fallback (no WebGL, weak
     devices, reduced motion) with the same actions;
   • the WebGL renderer (./gl, lazy-loaded three.js) crossfades in after its first frame.
   Both draw the same model through the same projection, so a swap mid-sequence is seamless.
   ========================================================================== */
import type { TreeScene, TreeSceneState, Hotspot, BirthPhase } from '../scene-api';
import { env, hasWebGL } from '../../core/env';
import { bus } from '../../core/bus';
import { gsap } from '../../core/gsap';
import { sound } from '../../core/sound';
import { he } from '../../content/he';
import { createPlaqueEngraver, renderPlaque, type PlaqueEngraver } from '../../components/plaque';
import { Projector, composition, fit, type CamParams } from './camera';
import { computeLook, approachLook, cloneLook, type Look } from './look';
import {
  generateModel, grow, growthOf, rootRevealOf, seasonLook, sizeOf, ISLAND, PLAQUE, TOKEN, autumnTint, leafGreen,
  type TreeModel, type GrowResult, type SeasonLook,
} from './model';
import { speciesDef } from './species';
import { Overlay, ghostPathFor } from './overlay';
import { SvgRenderer } from './svg/renderer';
import { makeToken, paperGrain } from './textures';
import type { Anim, Frame, Renderer, FallingLeaf } from './types';
import { clamp, lerp, damp, smooth, css, mixC, DEG, TAU, type V3 } from './util';
import './scene.css';

type Listener = (x: any) => void;
type Focus = 'plaque' | 'crown' | 'reset';
type CamLite = { tx: number; ty: number; tz: number; dist: number };

const PITCH = 0.165;
const FOV = 0.5;
const ROT_MAX = 25;

export function createTreeScene(initial: TreeSceneState): TreeScene {
  return new TreeSceneImpl(initial).api;
}

class TreeSceneImpl {
  state: TreeSceneState;
  readonly api: TreeScene;
  private container: HTMLElement | null = null;
  private root!: HTMLDivElement;
  private bgEl!: HTMLDivElement;
  private hostEl!: HTMLDivElement;
  private fogEl!: HTMLDivElement;
  private hazeEl!: HTMLDivElement;
  private glowEl!: HTMLDivElement;
  private overlay!: Overlay;
  private model!: TreeModel;
  private modelKey = '';
  private growRes!: GrowResult;
  private growKey = '';
  private proj = new Projector();
  private projRest = new Projector();
  private look!: Look;
  private lookTarget!: Look;
  private season!: SeasonLook;
  private seasonTarget!: SeasonLook;
  private a: Anim = {
    breathe: 1, fog: 0, appear: 1, plaqueRise: 1, plaqueGlow: 0, seed: 0, seedPulse: 0, crack: 0,
    spot: 0, seep: 0, wet: 0, rootGlow: 0, rootGlowA: 0, lift: 0, glisten: 0, ghost: 0, sibling: 0, news: 0, prune: 0,
    wind: 0.2, shake: 0, fruitSwing: -1, fruitSwingA: 0, greetPulse: -1, greetPulseA: 0, birthClose: 0, closeY: -0.12, closeD: 1,
  };
  private renderer: Renderer | null = null;
  private svgR: SvgRenderer | null = null;
  private glR: Renderer | null = null;
  private fading: Renderer | null = null;
  private kindNow: 'webgl' | 'svg' = 'svg';
  private glLoading = false;
  private glFailed = false;
  private raf = 0;
  private lastTs = 0;
  private clock = 0;
  private runUntil = 0;
  private paused = { user: false, hidden: false, offscreen: false };
  private w = 1; private h = 1; private dpr = 1;
  private motion = env.motionAllowed();
  // growth
  private gDisp = 0.3;
  private rootDisp = 0.5;
  private birth: { active: boolean; g: number; root: number; cot: number; hyp: number; tl: gsap.core.Timeline | null; resolve: (() => void) | null; onPhase?: (p: BirthPhase) => void; last?: BirthPhase } =
    { active: false, g: 0, root: 0, cot: 0, hyp: 1, tl: null, resolve: null };
  // camera
  private camFit: CamLite | null = null;
  private focusState: { from: CamLite; kind: Focus; k: number; tw: gsap.core.Tween | null } = { from: { tx: 0, ty: 0, tz: 0, dist: 5 }, kind: 'reset', k: 1, tw: null };
  private camEff: CamLite = { tx: 0, ty: 0.5, tz: 0, dist: 5 };
  private zoom = 1;
  private zoomTarget = 1;
  // rotation
  private yaw = 0; private yawV = 0; private yawRest = 0; private restUntil = 0; private dragging = false;
  private tiltT: [number, number] = [0, 0]; private tilt: [number, number] = [0, 0];
  private bob = 0;
  // misc
  private falling: FallingLeaf[] = [];
  private fallAcc = 0;
  private shakeT0 = -99; private shakeAmp = 0; private lastShake = 0;
  private engraver: PlaqueEngraver | null = null;
  private plaqueCanvas = document.createElement('canvas');
  private plaqueVersion = 1;
  private token!: HTMLCanvasElement;
  private hotspots: Hotspot[] = [];
  private hsSig = '';
  private hsLast = 0;
  private hsPendingTimer = 0;
  private listeners = new Map<string, Set<Listener>>();
  private disposers: (() => void)[] = [];
  private waterTl: gsap.core.Timeline | null = null;
  private spotTarget = 0;
  private wetBoost = 0;
  private bgSig = '';
  private ariaSig = '';
  private mounted = false;
  private disposed = false;
  private crossfadeT = 0;
  private lastFrame: Frame | null = null;
  private tmp: V3 = [0, 0, 0];

  constructor(initial: TreeSceneState) {
    this.state = { ...initial, greetings: [...(initial.greetings ?? [])] };
    this.look = computeLook(this.state);
    this.lookTarget = cloneLook(this.look);
    this.applyStaticAnims(true);
    const self = this;
    this.api = {
      get kind() { return self.kindNow; },
      mount: (c, o) => this.mount(c, o),
      setState: (p) => this.setState(p),
      getState: () => ({ ...this.state, greetings: [...this.state.greetings] }),
      playBirth: (o) => this.playBirth(o),
      skipBirth: () => this.skipBirth(),
      playVisitIntro: () => this.playVisitIntro(),
      waterStart: () => this.waterStart(),
      waterProgress: (p) => this.waterProgress(p),
      waterEnd: (c) => this.waterEnd(c),
      shake: () => this.shake(),
      focus: (t) => this.focus(t),
      rotateBy: (d) => this.rotateBy(d),
      getHotspots: () => this.hotspots.map((h) => ({ ...h })),
      on: ((ev: string, cb: Listener) => this.on(ev, cb)) as TreeScene['on'],
      snapshot: (w, h) => this.snapshot(w, h),
      setPaused: (p) => { this.paused.user = !!p; this.kick(); },
      dispose: () => this.dispose(),
      poke: (id) => this.poke(id),
      hitTest: (x, y) => (this.mounted ? this.pick(x, y)?.kind ?? null : null),
    };
  }

  /* ================================================================ mount */
  private async mount(container: HTMLElement, opts?: { birth?: boolean }) {
    if (this.mounted) return;
    this.mounted = true;
    if (opts?.birth) this.preBirthPose();
    this.container = container;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const root = document.createElement('div');
    root.className = 'ts';
    root.setAttribute('role', 'img');
    root.dataset.motion = this.motion ? 'on' : 'off';
    this.root = root;
    this.bgEl = document.createElement('div'); this.bgEl.className = 'ts-bg';
    this.hostEl = document.createElement('div'); this.hostEl.className = 'ts-host';
    this.glowEl = document.createElement('div'); this.glowEl.className = 'ts-pglow';
    root.append(this.bgEl, this.glowEl, this.hostEl);
    this.overlay = new Overlay(root);
    this.hazeEl = document.createElement('div'); this.hazeEl.className = 'ts-haze';
    this.fogEl = document.createElement('div'); this.fogEl.className = 'ts-fog';
    root.append(this.hazeEl, this.fogEl);
    container.appendChild(root);
    this.measure();

    this.ensureModel();
    this.token = makeToken(`${location.origin}/tree/${this.state.id}`);
    this.setupPlaque();
    this.updateAria();

    const svg = new SvgRenderer(this.hostEl);
    this.svgR = svg;
    this.renderer = svg;
    this.kindNow = this.webglAllowed() ? 'webgl' : 'svg';
    const f = this.buildFrame(0);
    await svg.init(f);
    this.overlay.render(f);
    this.applyLayers(f);
    this.bindEvents();
    this.kick(2);
    if (this.webglAllowed()) void this.loadGL();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  /** mount({ birth }): the first frame is the birth's opening (empty paper, then the soil close-up) —
   *  never the grown tree for a split second. (WebGL still loads right away: shaders compile with
   *  compileAsync where KHR_parallel_shader_compile exists, and the swap mid-sequence is seamless.) */
  private preBirthPose() {
    const B = this.birth;
    B.active = true; B.tl = null; B.resolve = null; B.g = 0; B.root = 0; B.cot = 0; B.hyp = 0;
    if (this.motion) Object.assign(this.a, { birthClose: 1, closeY: ISLAND.SEED_Y + 0.03, closeD: 1, seed: 1, seedPulse: 0, crack: 0, plaqueRise: 0, appear: 0, fog: 0 });
    else { B.g = growthOf(this.state.ageDays); B.root = rootRevealOf(B.g); this.a.appear = 0; }
  }


  private webglAllowed() {
    return this.motion && this.state.quality > 0 && !this.glFailed && hasWebGL();
  }

  private async loadGL() {
    if (this.glLoading || this.glR || this.disposed) return;
    this.glLoading = true;
    try {
      const mod = await import('./gl/renderer');
      if (this.disposed || !this.webglAllowed()) { this.glLoading = false; return; }
      const r = mod.createGLRenderer(this.hostEl, this.model, this.state.quality, this.isPortrait(), () => this.onContextLost());
      r.resize(this.w, this.h, this.dpr);
      await r.init(this.buildFrame(0));
      if (this.disposed || !this.webglAllowed()) { r.dispose(); this.glLoading = false; return; }
      this.glR = r;
      // crossfade SVG → WebGL
      const old = this.renderer;
      (r.el as unknown as HTMLElement).style.opacity = '0';
      this.renderer = r;
      this.fading = old && old !== r ? old : null;
      this.kindNow = 'webgl';
      this.crossfadeT = 0;
      this.kick(2);
    } catch (e) {
      console.warn('[tree-scene] WebGL unavailable, staying on SVG', e);
      this.glFailed = true;
      this.kindNow = 'svg';
    }
    this.glLoading = false;
  }

  private onContextLost() {
    this.glFailed = true;
    this.switchToSvg();
  }

  private switchToSvg() {
    if (this.disposed) return;
    if (!this.svgR) {
      const svg = new SvgRenderer(this.hostEl);
      this.svgR = svg;
      void svg.init(this.buildFrame(0));
    }
    (this.svgR.el as unknown as HTMLElement).style.opacity = '1';
    if (this.glR) { this.glR.dispose(); this.glR = null; }
    this.fading = null;
    this.renderer = this.svgR;
    this.kindNow = 'svg';
    this.kick(2);
  }

  private measure() {
    const r = this.container!.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay?.resize(this.w, this.h, this.dpr);
    this.svgR?.resize(this.w, this.h);
    this.glR?.resize(this.w, this.h, this.dpr);
  }
  private isPortrait() { return this.w / this.h < 0.8 || env.isMobile(); }

  private ensureModel() {
    const key = `${this.state.seed}|${this.state.species}|${Math.max(1, this.state.quality)}|${this.isPortrait() ? 'm' : 'd'}`;
    if (key === this.modelKey && this.model) return;
    const first = !this.model;
    this.modelKey = key;
    this.model = generateModel(this.state.seed, this.state.species, Math.max(1, this.state.quality), this.isPortrait());
    this.growKey = '';
    this.camFit = null;
    const g = growthOf(this.state.ageDays);
    if (first || !this.birth.active) { this.gDisp = g; this.rootDisp = rootRevealOf(g); }
    this.season = seasonLook(this.model.species, this.state.season, g, this.state.harvestReady);
    this.seasonTarget = { ...this.season };
    if (!first) { this.svgR?.setModel(this.model); this.glR?.setModel(this.model); }
  }

  private setupPlaque() {
    const W = 1024, H = Math.round(1024 / 2.4);
    this.plaqueCanvas.width = W; this.plaqueCanvas.height = H;
    try {
      this.engraver = createPlaqueEngraver(this.plaqueCanvas, {
        width: W, height: H, memorial: this.state.mode === 'memorial', motion: this.motion, seed: this.state.seed,
        onRender: () => { this.plaqueVersion++; this.kick(); },
      });
      this.engraver.setText(this.state.dedication, { instant: true });
    } catch (e) { console.warn('[tree-scene] plaque', e); }
  }

  /* ================================================================ state */
  private setState(patch: Partial<TreeSceneState>) {
    const prev = this.state;
    this.state = { ...prev, ...patch, greetings: patch.greetings ? [...patch.greetings] : prev.greetings };
    const s = this.state;
    if (!this.mounted) { this.look = computeLook(s); this.lookTarget = cloneLook(this.look); this.applyStaticAnims(true); return; }
    if (patch.species !== undefined || patch.seed !== undefined || (patch.quality !== undefined && patch.quality !== prev.quality && patch.quality > 0)) this.ensureModel();
    if (patch.dedication !== undefined && patch.dedication !== prev.dedication) this.engraver?.setText(s.dedication, { instant: !this.motion });
    if (patch.mode !== undefined && patch.mode !== prev.mode) this.engraver?.setMemorial(s.mode === 'memorial');
    if (patch.id !== undefined && patch.id !== prev.id) this.token = makeToken(`${location.origin}/tree/${s.id}`);
    if (patch.quality !== undefined && patch.quality !== prev.quality && patch.quality > 0) this.glR?.setQuality?.(patch.quality);
    if (patch.quality === 0 && this.kindNow === 'webgl') this.switchToSvg();
    if (patch.quality && patch.quality > 0 && this.kindNow === 'svg' && this.webglAllowed()) void this.loadGL();
    this.lookTarget = computeLook(s);
    this.applyStaticAnims(false);
    this.updateAria();
    this.kick(1.6);
  }

  /** anims that simply follow state flags */
  private applyStaticAnims(instant: boolean) {
    const s = this.state;
    const dur = instant || !this.motion ? 0 : 0.6 * this.slow();
    const to = (key: keyof Anim, v: number, d = dur) => {
      if (d <= 0) { (this.a as any)[key] = v; return; }
      gsap.to(this.a, { [key]: v, duration: d, ease: 'power2.out', overwrite: 'auto', onUpdate: () => this.kick() });
    };
    to('ghost', s.futureGhost ? 1 : 0);
    to('sibling', s.siblingSpot ? 1 : 0);
    to('news', s.hasNews ? 1 : 0);
    to('prune', s.freshPrune ? 1 : 0);
    to('plaqueGlow', s.mode === 'memorial' ? 1 : 0, instant ? 0 : 1.2);
    if (!this.birth.active) {
      to('seed', s.planted ? 0 : 1);
      if (!s.planted) to('plaqueRise', 0); else if (this.a.plaqueRise < 1 && !this.birth.active) to('plaqueRise', 1);
    }
  }

  private slow() { return this.state.mode === 'memorial' ? 1.5 : 1; }

  private updateAria() {
    const txt = describe(this.state);
    if (txt !== this.ariaSig && this.root) { this.root.setAttribute('aria-label', txt); this.ariaSig = txt; }
  }

  /* ================================================================ loop */
  private kick(sec = 1.2) {
    this.runUntil = Math.max(this.runUntil, performance.now() + sec * 1000);
    if (!this.raf && !this.disposed && this.mounted && !this.isPaused()) {
      this.lastTs = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  private isPaused() { return this.paused.user || this.paused.hidden || this.paused.offscreen; }

  private tick = (ts: number) => {
    this.raf = 0;
    if (this.disposed || this.isPaused()) return;
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    const f = this.buildFrame(dt);
    this.renderer?.render(f);
    if (this.fading) {
      if (!this.crossfadeT) this.crossfadeT = ts;
      const k = clamp((ts - this.crossfadeT) / 800);
      const e = k * k * (3 - 2 * k);
      (this.renderer!.el as unknown as HTMLElement).style.opacity = String(e);
      (this.fading.el as unknown as HTMLElement).style.opacity = String(1 - e);
      this.fading.render(f);
      if (k >= 1) {
        if (this.fading === this.svgR) { this.svgR.dispose(); this.svgR = null; }
        this.fading = null;
      }
    }
    this.overlay.render(f);
    this.applyLayers(f);
    this.updateHotspots(f);
    this.lastFrame = f;
    const busy = this.motion || ts < this.runUntil || this.dragging || Math.abs(this.yawV) > 0.01 || this.falling.length > 0 || !!this.fading;
    if (busy) this.raf = requestAnimationFrame(this.tick);
  };

  private buildFrame(dt: number): Frame {
    const s = this.state;
    const slow = this.slow();
    this.clock += dt / slow;
    const k = 1 - Math.exp(-dt * 2.2);
    approachLook(this.look, this.lookTarget, dt === 0 ? 0 : k);
    if (dt === 0 && !this.lastFrame) this.look = cloneLook(this.lookTarget);

    // growth & season
    const gT = s.planted ? growthOf(s.ageDays) : 0.06;
    if (this.birth.active) { this.gDisp = this.birth.g; this.rootDisp = this.birth.root; }
    else {
      this.gDisp = dt ? damp(this.gDisp, gT, 5, dt) : gT;
      this.rootDisp = dt ? damp(this.rootDisp, rootRevealOf(gT), 4, dt) : rootRevealOf(gT);
      if (Math.abs(this.gDisp - gT) < 1e-4) this.gDisp = gT;
    }
    const st = seasonLook(this.model.species, s.season, this.gDisp, s.harvestReady);
    this.seasonTarget = st;
    if (!this.season || dt === 0 && !this.lastFrame) this.season = { ...st };
    else {
      const ks = 1 - Math.exp(-dt * 2.4);
      for (const key of Object.keys(st) as (keyof SeasonLook)[]) {
        this.season[key] += (st[key] - this.season[key]) * ks;
        if (Math.abs(this.season[key] - st[key]) < 0.002) this.season[key] = st[key];
      }
    }
    const q = (v: number, n = 400) => Math.round(v * n);
    const cot = this.birth.active ? this.birth.cot : 0;
    // birth close-up: the roots are the seed's own radicle + its underground stem, the adult system takes over in the pull-back
    const radicle = this.birth.active ? smooth(0.3, 0.85, this.a.birthClose) : 0;
    const hyp = this.birth.active ? this.birth.hyp : 1;
    const key = `${q(this.gDisp, 5000)}|${q(this.a.birthClose, 50)}|${s.planted}|${q(this.season.density)}|${q(this.season.autumn)}|${q(this.season.bloom)}|${q(this.season.fruit)}|${s.harvestReady}|${q(cot, 200)}|${q(this.rootDisp, 1000)}|${q(radicle, 100)}|${q(hyp, 200)}`;
    if (key !== this.growKey) {
      this.growRes = grow(this.model, { g: this.gDisp, planted: s.planted, look: this.season, ripe: s.harvestReady, cotyledon: cot, rootReveal: this.rootDisp, rootScale: lerp(1, 0.3, this.a.birthClose), radicle, hypocotyl: hyp }, this.growRes);
      this.growKey = key;
    }
    const G = this.growRes;

    // wind, wetness
    const ws = clamp(s.windStrength);
    let windT = s.weather === 'wind' ? Math.max(0.5, ws) : s.weather === 'rain' ? 0.3 + ws * 0.5 : s.weather === 'hamsin' ? 0.1 + ws * 0.3 : ws * 0.6 + 0.08;
    if (s.mode === 'memorial') windT *= 0.45;
    if (!this.motion) windT = 0;
    this.a.wind = dt ? damp(this.a.wind, windT, 1.5, dt) : windT;
    this.wetBoost = Math.max(0, this.wetBoost - dt / 30);
    const wetT = Math.max(clamp(s.soilMoisture), s.weather === 'rain' ? 0.9 : 0, this.wetBoost);
    this.a.wet = dt ? damp(this.a.wet, wetT, 1.2, dt) : wetT;
    if (!this.waterTl || !this.waterTl.isActive()) {
      if (this.spotTarget > 0) this.a.spot = dt ? damp(this.a.spot, this.spotTarget, 4, dt) : this.spotTarget;
    }

    // shake
    const st0 = this.clock - this.shakeT0;
    this.a.shake = st0 < 3 ? this.shakeAmp * Math.sin(st0 * 13) * Math.exp(-st0 * 3.1) : 0;

    // rotation physics (deg)
    if (!this.dragging) {
      if (performance.now() > this.restUntil) this.yawRest = dt ? damp(this.yawRest, 0, 1.6, dt) : 0;
      const kSpring = 9, cDamp = 5.2;
      const acc = -kSpring * (this.yaw - this.yawRest) - cDamp * this.yawV;
      this.yawV += acc * dt;
      this.yaw += this.yawV * dt;
      if (Math.abs(this.yawV) < 0.01 && Math.abs(this.yaw - this.yawRest) < 0.01) { this.yaw = this.yawRest; this.yawV = 0; }
      this.yaw = clamp(this.yaw, -ROT_MAX - 6, ROT_MAX + 6);
    }
    for (let i = 0; i < 2; i++) this.tilt[i] = dt ? damp(this.tilt[i], this.motion ? this.tiltT[i] : 0, 3, dt) : 0;
    this.zoom = dt ? damp(this.zoom, this.zoomTarget, 8, dt) : this.zoomTarget;
    // tell the page while the crown is pinched in (it clears the panel off the enlarged scene)
    const zoomed = this.zoomTarget > 1.04 || this.zoom > 1.04;
    if (this.container && ('zoomed' in this.container.dataset) !== zoomed) {
      if (zoomed) this.container.dataset.zoomed = ''; else delete this.container.dataset.zoomed;
    }

    // camera
    const w = this.w, h = this.h;
    const comp = composition(w, h, this.container);
    const box = this.contentBox(G);
    const fitT = fit(box.min, box.max, comp, w, h, FOV, PITCH);
    if (!this.camFit || !dt) this.camFit = { ...fitT };
    else {
      const kc = 1 - Math.exp(-dt * 3.5);
      this.camFit.tx += (fitT.tx - this.camFit.tx) * kc; this.camFit.ty += (fitT.ty - this.camFit.ty) * kc;
      this.camFit.tz += (fitT.tz - this.camFit.tz) * kc; this.camFit.dist += (fitT.dist - this.camFit.dist) * kc;
    }
    const close: CamLite = { tx: 0, ty: this.a.closeY, tz: ISLAND.ZC, dist: (comp.portrait ? 0.86 : 0.78) * this.a.closeD };
    const bc = this.a.birthClose;
    // phones: the close-up has no island to leave room for → centre it (the island's own spot is the top 60 %)
    if (comp.portrait && bc > 0) comp.cy = lerp(comp.cy, h * 0.52, bc);
    // the pull-back interpolates distance in log space (feels like a dolly, not a zoom)
    const base: CamLite = {
      tx: lerp(this.camFit.tx, close.tx, bc), ty: lerp(this.camFit.ty, close.ty, bc), tz: lerp(this.camFit.tz, close.tz, bc),
      dist: Math.exp(lerp(Math.log(this.camFit.dist), Math.log(close.dist), bc)),
    };
    const fs = this.focusState;
    const tgt = fs.kind === 'reset' ? base : this.focusCam(fs.kind, base, comp);
    const e = fs.k;
    const cam: CamLite = {
      tx: lerp(fs.from.tx, tgt.tx, e), ty: lerp(fs.from.ty, tgt.ty, e), tz: lerp(fs.from.tz, tgt.tz, e),
      dist: Math.exp(lerp(Math.log(fs.from.dist), Math.log(tgt.dist), e)),
    };
    // pinch zoom → toward the crown
    if (this.zoom > 1.001) {
      const zk = clamp(this.zoom - 1);
      cam.tx = lerp(cam.tx, G.crownC[0], zk * 0.85); cam.ty = lerp(cam.ty, G.crownC[1] * this.a.breathe, zk * 0.85); cam.tz = lerp(cam.tz, ISLAND.ZT + G.crownC[2], zk * 0.5);
    }
    this.camEff = cam;
    const camP: CamParams = { ...cam, pitch: PITCH, fov: FOV, zoom: this.zoom, w, h, cx: comp.cx, cy: comp.cy };
    // float: 6 px up and down, 6 s cycle (in world units at the current scale)
    const ppu = ((h / 2) / Math.tan(FOV / 2) * this.zoom) / Math.max(0.1, cam.dist);
    this.bob = this.motion ? (Math.sin(this.clock * TAU / 6) * 3) / ppu : 0;
    const yawRad = (this.yaw + this.tilt[0]) * DEG;
    this.proj.update(camP, { yaw: yawRad, tilt: this.tilt[1] * DEG, bob: this.bob, treeScale: this.a.breathe });
    this.projRest.update(camP, { yaw: yawRad, tilt: this.tilt[1] * DEG, bob: 0, treeScale: 1 });

    // falling leaves
    this.updateFalling(dt, G);

    const greetLeaves: number[] = [];
    if (G.greeting.length) for (let i = 0; i < s.greetings.length; i++) greetLeaves.push(G.greeting[i % G.greeting.length]);
    return {
      time: this.clock, dt, state: s, look: this.look, season: this.season, proj: this.proj, model: this.model, grow: G, a: this.a,
      falling: this.falling, motion: this.motion, quality: s.quality, w, h, dpr: this.dpr,
      plaque: { canvas: this.plaqueCanvas, version: this.plaqueVersion }, token: this.token, greetLeaves,
      sceneKey: `${G.version}|${s.mode}|${s.season}`,
    };
  }

  private contentBox(G: GrowResult) {
    const I = this.model.island;
    const min: V3 = [-1.02, I.faceBottom - 0.02, -1.0];
    const max: V3 = [1.02, 0.32, ISLAND.ZC];
    if (this.state.planted) {
      min[0] = Math.min(min[0], G.bbox.min[0]); max[0] = Math.max(max[0], G.bbox.max[0]);
      max[1] = Math.max(max[1], G.top + 0.08);
    }
    // an empty island (before planting) or a sapling is framed with room to grow — the island keeps the size it has
    // under a young tree instead of being blown up to fill the stage (and run into the text beside and under it)
    max[1] = Math.max(max[1], this.model.height * 0.52 + 0.08);
    if (this.state.futureGhost) {
      const M = this.model;
      const d = this.state.ghostAgeDays;
      const gs = d == null || !Number.isFinite(d) ? 1 : sizeOf(growthOf(d));
      const r = M.crownR.map((v) => v * gs), c = M.crownC.map((v) => v * gs);
      min[0] = Math.min(min[0], c[0] - r[0] * 1.05); max[0] = Math.max(max[0], c[0] + r[0] * 1.05);
      max[1] = Math.max(max[1], c[1] + r[1] + 0.12);
    }
    return { min, max };
  }

  private focusCam(kind: Focus, base: CamLite, comp: ReturnType<typeof composition>): CamLite {
    const F0 = (this.h / 2) / Math.tan(FOV / 2);
    if (kind === 'plaque') {
      const frac = comp.portrait ? 0.8 : 0.34;
      const dist = (PLAQUE.w * F0) / (frac * this.w) + 0.02;
      // landscape: the plaque steps to the left third, its card sits beside it on the reading side (not over it)
      const shift = comp.portrait ? 0 : ((comp.cx - this.w * 0.33) * dist) / F0;
      return { tx: PLAQUE.x + shift, ty: PLAQUE.y + 0.01, tz: PLAQUE.z, dist };
    }
    const G = this.growRes;
    const r = Math.max(0.25, G.crownR * 1.25);
    return { tx: G.crownC[0], ty: G.crownC[1] * this.a.breathe, tz: ISLAND.ZT + G.crownC[2], dist: Math.max(0.6, (2 * r * F0) / (comp.fracH * this.h * 1.05)) };
  }

  private applyLayers(f: Frame) {
    const L = f.look;
    const bg = css(L.bg);
    const sig = `${bg}|${css(L.glow)}|${Math.round(L.glowA * 50)}|${Math.round(L.glowX * 100)}|${Math.round(L.glowY * 100)}|${Math.round(L.night * 20)}`;
    if (sig !== this.bgSig) {
      this.bgSig = sig;
      const gx = (L.glowX * 100).toFixed(1), gy = (L.glowY * 100).toFixed(1);
      this.bgEl.style.background = `radial-gradient(ellipse ${Math.round(L.glowR * 140)}% ${Math.round(L.glowR * 110)}% at ${gx}% ${gy}%, ${css(L.glow, L.glowA)} 0%, ${css(L.glow, L.glowA * 0.35)} 38%, ${css(L.bg, 0)} 72%), ${bg}`;
      this.root.style.setProperty('--ts-bg', bg);
      this.container?.style.setProperty('--tree-scene-bg', bg);
      const tone = L.night > 0.5 ? 'dark' : 'light';
      if (this.container && this.container.dataset.sceneTone !== tone) this.container.dataset.sceneTone = tone;
      this.root.dataset.tone = tone;
    }
    // memorial: a warm light behind the plaque (drawn under the scene, like a candle behind it)
    const pg = f.a.plaqueGlow * f.a.plaqueRise;
    if (pg > 0.01) {
      const P = f.proj, t = this.tmp;
      P.island(PLAQUE.x, PLAQUE.y + 0.05, PLAQUE.z - 0.2, t);
      const r = PLAQUE.w * P.pxPerUnit(t[2]) * 1.3;
      const breathe = f.motion ? 0.85 + 0.15 * Math.sin(f.time * 0.9) : 0.92;
      this.glowEl.style.transform = `translate3d(${Math.round(t[0] - r)}px, ${Math.round(t[1] - r)}px, 0)`;
      this.glowEl.style.width = this.glowEl.style.height = `${Math.round(r * 2)}px`;
      this.glowEl.style.opacity = String(Math.round(pg * breathe * 1000) / 1000);
    } else if (this.glowEl.style.opacity !== '0') this.glowEl.style.opacity = '0';
    this.fogEl.style.opacity = f.a.fog > 0.003 ? String(Math.round(f.a.fog * 1000) / 1000) : '0';
    if (f.a.fog > 0.003) this.fogEl.style.transform = `scale(${(1 + f.a.fog * 0.06).toFixed(4)})`;
    this.hazeEl.style.opacity = String(Math.round(L.haze * 0.55 * 1000) / 1000);
    this.hostEl.style.opacity = f.a.appear >= 0.999 ? '' : String(Math.round(f.a.appear * 1000) / 1000);
  }

  /* ================================================================ falling leaves */
  private spawnLeaf(G: GrowResult, petal = false) {
    if (this.falling.length > 48) return;
    const M = this.model, L = M.leaves;
    let x: number, y: number, z: number, color;
    if (petal && G.blossomCount) {
      const k = Math.floor(Math.random() * G.blossomCount);
      x = G.blossomXYZ[k * 3]; y = G.blossomXYZ[k * 3 + 1]; z = G.blossomXYZ[k * 3 + 2];
      color = M.species.bloom?.color ?? [1, 1, 1];
    } else {
      if (!G.leafCount) return;
      const k = Math.floor(Math.random() * G.leafCount);
      const li = G.leaves[k];
      x = L.x[li] * G.s; y = L.y[li] * G.s; z = L.z[li] * G.s;
      color = G.leafAutumn[k] > 0.5 ? autumnTint(M, li) : leafGreen(M, li, this.season.fresh);
      if (this.season.autumn > 0.3 && Math.random() < this.season.autumn) color = autumnTint(M, li);
    }
    this.falling.push({
      x, y, z: z + ISLAND.ZT, vx: (Math.random() - 0.5) * 0.3, vy: 0.05 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.2,
      rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 5, tilt: 0, phase: Math.random() * TAU,
      size: (petal ? 0.6 : 1) * M.species.leaf.len * Math.pow(G.s, 0.45) * (0.85 + Math.random() * 0.3),
      color: [...color] as any, life: 0, landed: -1, alpha: 1, petal,
    });
  }
  private updateFalling(dt: number, G: GrowResult) {
    if (!dt) return;
    // autumn: leaves drift down on their own
    if (this.motion && this.state.planted && this.season.falling > 0.01 && G.leafCount > 0) {
      this.fallAcc += dt * this.season.falling * (0.6 + this.a.wind) / this.slow();
      while (this.fallAcc > 1) { this.fallAcc -= 1; this.spawnLeaf(G); }
    }
    const I = this.model.island;
    const wind = this.a.wind;
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const p = this.falling[i];
      p.life += dt;
      if (p.landed < 0) {
        p.vy = damp(p.vy, -0.24, 1.4, dt);
        p.x += (p.vx + Math.sin(p.life * 2.2 + p.phase) * 0.16 + wind * 0.14) * dt;
        p.z += (p.vz + Math.cos(p.life * 1.6 + p.phase) * 0.05) * dt;
        p.vx *= 1 - dt * 0.8; p.vz *= 1 - dt * 0.8;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        p.tilt = Math.sin(p.life * 3.1 + p.phase) * 0.7;
        const a = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
        if (p.y <= 0.004 && r < I.rimR(a) * 0.95 && p.z < ISLAND.ZC - 0.01 && p.y > -0.05) { p.y = 0.004; p.landed = 0; p.tilt = 0; }
        if (p.y < -1.8) { this.falling.splice(i, 1); continue; }
        p.alpha = p.y < -0.05 ? clamp(1 + (p.y + 0.05) / 1.2) : 1;
      } else {
        p.landed += dt;
        p.alpha = 1 - smooth(4.5, 7, p.landed);
        if (p.landed > 7) this.falling.splice(i, 1);
      }
    }
  }

  /* ================================================================ sequences */
  private async playBirth(opts?: { onPhase?: (p: BirthPhase) => void; signal?: AbortSignal }): Promise<void> {
    if (!this.mounted) return;
    this.skipBirth(true);
    this.focusReset(true);
    const slow = this.slow();
    const B = this.birth;
    B.active = true; B.onPhase = opts?.onPhase;
    const gEnd = growthOf(this.state.ageDays);
    const rootEnd = rootRevealOf(gEnd);
    const a = this.a;
    if (!this.state.planted) this.state = { ...this.state, planted: true };
    this.engraver?.setText(this.state.dedication, { instant: true });
    B.last = undefined;
    const phase = (p: BirthPhase) => { B.last = p; try { B.onPhase?.(p); } catch (e) { console.error(e); } };
    if (opts?.signal) {
      if (opts.signal.aborted) { this.skipBirth(); return; }
      opts.signal.addEventListener('abort', () => this.skipBirth(), { once: true });
    }
    return new Promise<void>((resolve) => {
      B.resolve = resolve;
      if (!this.motion) {
        // reduced motion: the same story as quiet cross-fades, phases still reported
        B.g = gEnd; B.root = rootEnd; B.cot = 0;
        Object.assign(a, { birthClose: 0, seed: 0, crack: 0, plaqueRise: 1, appear: 0 });
        const tl = gsap.timeline({ onUpdate: () => this.kick(), onComplete: () => this.finishBirth() });
        tl.call(() => phase('soil'), [], 0).call(() => phase('crack'), [], 0.25).call(() => phase('sprout'), [], 0.5)
          .call(() => phase('reveal'), [], 0.75).to(a, { appear: 1, duration: 0.6, ease: 'power1.out' }, 0.75);
        B.tl = tl;
        return;
      }
      B.g = 0; B.root = 0; B.cot = 0; B.hyp = 0;
      Object.assign(a, { birthClose: 1, closeY: ISLAND.SEED_Y + 0.03, closeD: 1, seed: 1, seedPulse: 0, crack: 0, plaqueRise: 0, appear: 1, fog: 0 });
      // the engraving is almost finished; its last letters burn during the reveal
      this.engraver?.setMotion(true);
      try {
        this.engraver?.setText(this.state.dedication, { instant: true });
        renderPlaque(this.plaqueCanvas, this.state.dedication, {
          burnProgress: 0.7, laser: false, width: this.plaqueCanvas.width, height: this.plaqueCanvas.height,
          memorial: this.state.mode === 'memorial', seed: this.state.seed,
        });
        this.plaqueVersion++;
      } catch { /* ignore */ }
      const tl = gsap.timeline({ onUpdate: () => this.kick(), onComplete: () => this.finishBirth() });
      tl.timeScale(1 / slow);
      // 0–1.2: soil, the seed breathes
      tl.call(() => phase('soil'), [], 0);
      tl.fromTo(a, { seedPulse: 0 }, { seedPulse: 1, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      tl.fromTo(a, { appear: 0 }, { appear: 1, duration: 0.6, ease: 'power1.out' }, 0);
      // 1.2–2.4: three cracks, a dry quiet click each
      tl.call(() => phase('crack'), [], 1.2);
      [1.25, 1.62, 2.0].forEach((t0, i) => {
        tl.to(a, { crack: i + 1, duration: 0.12, ease: 'power4.out' }, t0);
        tl.call(() => sound.play('crack', { volume: 0.55 + i * 0.1 }), [], t0);
      });
      // 2.4–4.0: the radicle leaves the seed downward and branches; the pale stem climbs from the seed to the
      // surface, the sprout breaks through, and the first two leaves spring open. The camera steps back a little
      // so the whole seedling (leaves, seed, radicle) is in the frame.
      tl.call(() => phase('sprout'), [], 2.4);
      const radicleLen = 0.14 / Math.max(0.1, this.model.rootsys.mMax);
      tl.to(B, { root: radicleLen, duration: 1.6, ease: 'power1.out' }, 2.4);
      tl.to(B, { hyp: 1, duration: 0.6, ease: 'power1.inOut' }, 2.55);
      tl.to(B, { g: 0.013, duration: 0.85, ease: 'power2.out' }, 3.1);
      tl.to(a, { closeY: -0.03, duration: 1.5, ease: 'power2.inOut' }, 2.45);
      tl.to(a, { closeD: 1.3, duration: 1.5, ease: 'power2.inOut' }, 2.45);
      tl.to(B, { cot: 1, duration: 0.75, ease: 'elastic.out(1, 0.5)' }, 3.45);
      tl.call(() => sound.play('pop', { volume: 0.35 }), [], 3.5);
      // 4.0–6.0: camera pulls back, the island, the plaque rises, the engraving finishes on its last letter.
      // The tree grows only once the camera has stepped back (no trunk in the close-up).
      tl.call(() => phase('reveal'), [], 4.0);
      tl.to(a, { birthClose: 0, duration: 2.0, ease: 'power2.inOut' }, 4.0);
      tl.to(a, { seed: 0, duration: 0.6, ease: 'power1.in' }, 4.55);
      tl.to(B, { g: Math.max(0.02, gEnd), duration: 1.7, ease: 'power2.inOut' }, 4.3);
      tl.to(B, { root: rootEnd, duration: 1.8, ease: 'power2.inOut' }, 4.2);
      tl.to(B, { cot: gEnd > 0.1 ? 0 : 1, duration: 1.2, ease: 'power1.inOut' }, 4.7);
      // the plaque rises once the camera has stepped back far enough to show it whole (not a giant plank across the header)
      tl.to(a, { plaqueRise: 1, duration: 1.05, ease: 'expo.out' }, 4.95);
      // burnAll runs at total/duration chars per second: the last 30 % of the letters in ≈ 1 s → duration 3.4,
      // starting as the plaque clears the soil and ending on the last letter at 6.0
      tl.call(() => { void this.engraver?.burnAll({ from: 0.7, duration: 3.4 * slow }); }, [], 5.0);
      tl.call(() => phase('done'), [], 6.0);
      B.tl = tl;
    });
  }

  private finishBirth() {
    const B = this.birth;
    if (!B.active) return;
    const gEnd = growthOf(this.state.ageDays);
    B.active = false;
    B.tl = null;
    this.gDisp = Math.max(0.02, gEnd); this.rootDisp = rootRevealOf(gEnd); B.hyp = 1;
    Object.assign(this.a, { birthClose: 0, closeD: 1, seed: 0, crack: 0, plaqueRise: 1, appear: 1 });
    this.growKey = '';
    if (B.last !== 'done') { B.last = 'done'; try { B.onPhase?.('done'); } catch { /* ignore */ } }
    const r = B.resolve; B.resolve = null; B.onPhase = undefined;
    this.kick(1);
    r?.();
  }

  private skipBirth(silent = false) {
    const B = this.birth;
    if (!B.active) return;
    B.tl?.kill();
    if (silent) { B.active = false; B.tl = null; const r = B.resolve; B.resolve = null; r?.(); return; }
    // jump to the end: engraving finished, everything in place
    try { this.engraver?.setMotion(false); this.engraver?.setMotion(this.motion); this.engraver?.resize(); } catch { /* ignore */ }
    this.plaqueVersion++;
    if (B.onPhase && B.last !== 'reveal' && B.last !== 'done') { B.last = 'reveal'; try { B.onPhase('reveal'); } catch { /* ignore */ } }
    this.finishBirth();
  }

  private playVisitIntro(): Promise<void> {
    if (!this.mounted) return Promise.resolve();
    // a birth pose that never played (the flow changed): settle on the grown tree first
    if (this.birth.active && !this.birth.tl) this.finishBirth();
    const a = this.a;
    const slow = this.slow();
    return new Promise((resolve) => {
      if (!this.motion) {
        a.fog = 0; a.appear = 0;
        gsap.to(a, { appear: 1, duration: 0.5, ease: 'power1.out', onUpdate: () => this.kick(), onComplete: () => resolve() });
        return;
      }
      const tl = gsap.timeline({ onUpdate: () => this.kick(), onComplete: () => resolve() });
      tl.timeScale(1 / slow);
      tl.fromTo(a, { fog: 1, appear: 0 }, { fog: 0, appear: 1, duration: 0.9, ease: 'power2.out' }, 0);
      tl.to(a, { breathe: 1.02, duration: 0.8, ease: 'sine.inOut' }, 0.55);
      tl.to(a, { breathe: 1, duration: 1.0, ease: 'sine.inOut' }, 1.35);
    });
  }

  /* ---- watering ---- */
  private waterStart() {
    this.waterTl?.kill(); this.waterTl = null;
    this.spotTarget = 0.1;
    if (!this.motion) this.a.spot = 0.1;
    this.kick(2);
  }
  private waterProgress(p: number) {
    this.spotTarget = 0.1 + 0.9 * clamp(p);
    if (!this.motion) this.a.spot = this.spotTarget;
    this.kick(1);
  }
  private waterEnd(counted: boolean): Promise<void> {
    const a = this.a;
    const slow = this.slow();
    this.waterTl?.kill();
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onUpdate: () => this.kick(), onComplete: () => { this.spotTarget = 0; resolve(); } });
      this.waterTl = tl;
      if (!counted) {
        tl.to(a, { spot: 0, duration: 0.6, ease: 'power2.out' });
        return;
      }
      if (!this.motion) {
        // reduced motion: soil darkens, roots are shown lit, then calm
        tl.set(a, { spot: 1, seep: 1, rootGlow: 1 }).to(a, { rootGlowA: 0.8, glisten: 0.6, duration: 0.4 })
          .to(a, { rootGlowA: 0, glisten: 0, spot: 0, duration: 0.6 }, 2.4);
        this.wetBoost = 1;
        return;
      }
      tl.timeScale(1 / slow);
      sound.play('absorb', { volume: 0.8 });
      tl.to(a, { spot: 1, duration: 0.35, ease: 'power2.out' }, 0);
      tl.fromTo(a, { seep: 0 }, { seep: 1, duration: 1.2, ease: 'power1.inOut' }, 0.05);
      tl.fromTo(a, { rootGlow: 0 }, { rootGlow: 1, duration: 0.8, ease: 'power2.inOut' }, 0.95);
      tl.to(a, { rootGlowA: 1, duration: 0.25, ease: 'power2.out' }, 0.9);
      tl.to(a, { lift: 1, duration: 0.7, ease: 'expo.out' }, 1.1);
      tl.to(a, { glisten: 1, duration: 0.35, ease: 'power2.out' }, 1.2);
      tl.call(() => { this.wetBoost = 1; }, [], 1.2);
      tl.to(a, { rootGlowA: 0, duration: 1.4, ease: 'power2.inOut' }, 2.6);
      tl.to(a, { spot: 0, duration: 2.6, ease: 'power1.inOut' }, 2.4);
      tl.to(a, { glisten: 0, duration: 0.9, ease: 'power2.in' }, 4.3);
      tl.to(a, { lift: 0, duration: 2.4, ease: 'sine.inOut' }, 4.6);
      tl.set(a, { seep: 0 }, 6.5);
      // about one watering in three a bird lands on a branch for 2 s (never in memorial mode)
      if (this.state.mode !== 'memorial' && Math.random() < 1 / 3) {
        tl.call(() => { if (this.lastFrame) { this.overlay.landBird(this.lastFrame, 2); sound.play('bird', { volume: 0.5 }); } }, [], 1.5);
      }
      // the promise resolves after the main beat (seep + roots), the rest keeps glistening
      gsap.delayedCall(2.2 * slow, () => resolve());
    });
  }

  private shake() {
    const now = performance.now();
    if (now - this.lastShake < 350) return;
    this.lastShake = now;
    sound.play('rustle', { volume: 0.8 });
    if (!this.mounted || !this.state.planted) return;
    const G = this.growRes;
    this.shakeT0 = this.clock;
    this.shakeAmp = this.motion ? (Math.random() < 0.5 ? -1 : 1) : 0;
    if (!this.motion) return;
    const autumn = this.season.autumn > 0.3 && !this.model.species.evergreen;
    let n = autumn ? 7 + Math.floor(Math.random() * 5) : 3 + Math.floor(Math.random() * 4);
    n = Math.min(n, Math.ceil(G.leafCount * 0.25));
    for (let i = 0; i < n; i++) this.spawnLeaf(G);
    if (G.blossomCount) for (let i = 0; i < 5; i++) this.spawnLeaf(G, true);
    this.kick(3);
  }

  private focus(target: Focus): Promise<void> {
    if (target === 'reset') this.zoomTarget = 1;
    if (this.focusState.kind === target && this.focusState.k >= 1) return Promise.resolve();
    const fs = this.focusState;
    fs.tw?.kill();
    fs.from = { ...this.camEff };
    // when zoomed in, start from the un-zoomed camera (the zoom eases out on its own)
    fs.kind = target;
    fs.k = 0;
    const dur = this.motion ? 0.9 * this.slow() : 0.001;
    return new Promise((resolve) => {
      fs.tw = gsap.to(fs, { k: 1, duration: dur, ease: 'power3.inOut', onUpdate: () => this.kick(), onComplete: () => { fs.tw = null; resolve(); } });
      this.kick(dur + 0.3);
    });
  }
  private focusReset(instant: boolean) {
    const fs = this.focusState;
    fs.tw?.kill(); fs.kind = 'reset'; fs.k = 1; this.zoomTarget = 1;
    if (instant) this.zoom = 1;
  }

  private rotateBy(deg: number) {
    this.yawRest = clamp(this.yawRest + deg, -ROT_MAX, ROT_MAX);
    this.restUntil = performance.now() + 3200;
    if (!this.motion) { this.yaw = this.yawRest; this.yawV = 0; }
    this.kick(2);
  }

  /* ================================================================ hotspots */
  private updateHotspots(f: Frame) {
    const now = performance.now();
    const list = this.computeHotspots(f);
    const sig = list.map((h) => `${h.id}:${h.visible ? 1 : 0}:${Math.round(h.x / 3)}:${Math.round(h.y / 3)}`).join('|');
    if (sig === this.hsSig) return;
    const membership = list.map((h) => `${h.id}:${h.visible ? 1 : 0}`).join('|') !== this.hotspots.map((h) => `${h.id}:${h.visible ? 1 : 0}`).join('|');
    this.hotspots = list;
    if (membership || now - this.hsLast > 120) {
      this.hsLast = now;
      this.hsSig = sig;
      clearTimeout(this.hsPendingTimer);
      this.emit('hotspots-change', this.hotspots.map((h) => ({ ...h })));
    } else if (!this.hsPendingTimer) {
      this.hsPendingTimer = window.setTimeout(() => {
        this.hsPendingTimer = 0;
        this.hsLast = performance.now();
        this.hsSig = this.hotspots.map((h) => `${h.id}:${h.visible ? 1 : 0}:${Math.round(h.x / 3)}:${Math.round(h.y / 3)}`).join('|');
        this.emit('hotspots-change', this.hotspots.map((h) => ({ ...h })));
      }, 130);
    }
  }

  private computeHotspots(f: Frame): Hotspot[] {
    const P = this.projRest, s = this.state, G = f.grow, M = this.model, t = this.tmp;
    const out: Hotspot[] = [];
    const on = (x: number, y: number) => x > 4 && y > 4 && x < this.w - 4 && y < this.h - 4;
    const push = (id: string, kind: Hotspot['kind'], x: number, y: number, vis: boolean, label: string) =>
      out.push({ id, kind, x: Math.round(x), y: Math.round(y), visible: vis && on(x, y), label });
    const planted = s.planted;
    const plaqueOk = planted && f.a.plaqueRise > 0.85 && !this.birth.active;
    P.island(PLAQUE.x, PLAQUE.y, PLAQUE.z, t);
    push('plaque', 'plaque', t[0], t[1], plaqueOk, `השלט: ${s.dedication}`);
    P.island(TOKEN.x, TOKEN.y, TOKEN.z + 0.01, t);
    push('qr', 'qr', t[0], t[1], plaqueOk, he.tree.qrNote);
    // fruits (front-most first, at most 8)
    if (planted && G.fruitCount) {
      const FR = M.fruits;
      const cand: { i: number; z: number; x: number; y: number }[] = [];
      for (let k = 0; k < G.fruitCount; k++) {
        const i = G.fruits[k];
        P.tree(G.fruitXYZ[k * 3], G.fruitXYZ[k * 3 + 1], G.fruitXYZ[k * 3 + 2], t);
        cand.push({ i, z: G.fruitXYZ[k * 3 + 2], x: t[0], y: t[1] });
      }
      cand.sort((p, q) => q.z - p.z);
      const picked: typeof cand = [];
      for (const c of cand) { if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 34)) picked.push(c); if (picked.length >= 8) break; }
      picked.sort((p, q) => q.x - p.x);
      picked.forEach((c) => push(`fruit-${c.i}`, 'fruit', c.x, c.y, true, `פרי. ${he.tree.gestures.whenHarvest}`));
    }
    // greeting leaves
    const L = M.leaves;
    s.greetings.forEach((g, i) => {
      const li = f.greetLeaves[i];
      if (li == null || !planted) { push(`greeting-${g.id}`, 'greeting', 0, 0, false, `עלה ברכה ${g.initials}`); return; }
      const len = L.size[li] * 1.35 * Math.pow(G.s, 0.45) * 0.5;
      P.tree(L.x[li] * G.s + L.dx[li] * len, L.y[li] * G.s + L.dy[li] * len, L.z[li] * G.s + L.dz[li] * len, t);
      push(`greeting-${g.id}`, 'greeting', t[0], t[1], planted && G.leafCount > 0, `עלה ברכה ${g.initials}`);
    });
    // crown leaves
    P.tree(G.crownC[0], G.crownC[1], G.crownC[2], t);
    push('leaf', 'leaf', t[0], t[1], planted && G.leafCount > 0, 'עלי העץ');
    // trunk
    const tr = G.trunk[Math.min(G.trunk.length - 1, Math.max(0, Math.floor(G.trunk.length * 0.45)))];
    if (tr) P.tree(tr.x, Math.max(tr.y, 0.12), tr.z, t); else P.island(0, 0.1, ISLAND.ZT, t);
    push('trunk', 'trunk', t[0], t[1], planted && !!tr, 'מנערים את העץ');
    // ground
    P.island(0.42, -0.3, ISLAND.ZC, t);
    push('ground', 'ground', t[0], t[1], true, 'האדמה והשורשים');
    return out;
  }

  /* ================================================================ gestures */
  private bindEvents() {
    const root = this.root;
    const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
    let mode: 'none' | 'tap' | 'drag' | 'pinch' = 'none';
    let yaw0 = 0, lastX = 0, lastT = 0, vel = 0;
    let pinch0 = 0, zoom0 = 1;
    let longTimer = 0;
    let lastTap = { t: 0, x: 0, y: 0 };
    const local = (e: PointerEvent) => { const r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const p = local(e);
      pointers.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: performance.now() });
      if (pointers.size === 1) {
        mode = 'tap'; yaw0 = this.yaw; lastX = p.x; lastT = performance.now(); vel = 0;
        clearTimeout(longTimer);
        longTimer = window.setTimeout(() => { if (mode === 'tap') { mode = 'none'; this.longPress(p.x, p.y); } }, 560);
      } else if (pointers.size === 2) {
        clearTimeout(longTimer);
        const [a, b] = [...pointers.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.zoomTarget; mode = 'pinch';
        this.dragging = false;
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (!pointers.size) {
        // cursor parallax: the island turns slightly toward the pointer (≤ 4°)
        if (e.pointerType === 'mouse') { this.tiltT = [clamp((p.x / this.w - 0.5) * 2) * 4, clamp((p.y / this.h - 0.5) * 2) * -2.2]; this.kick(1); }
        return;
      }
      const ptr = pointers.get(e.pointerId);
      if (!ptr) return;
      ptr.x = p.x; ptr.y = p.y;
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomTarget = clamp(zoom0 * (d / Math.max(1, pinch0)), 1, 2);
        this.kick(1);
        return;
      }
      const dx = p.x - ptr.x0, dy = p.y - ptr.y0;
      if (mode === 'tap' && Math.hypot(dx, dy) > 8) {
        clearTimeout(longTimer);
        if (Math.abs(dx) > Math.abs(dy) * 1.1) { mode = 'drag'; this.dragging = true; root.setPointerCapture?.(e.pointerId); }
        else mode = 'none';
      }
      if (mode === 'drag') {
        const raw = yaw0 + dx * (180 / Math.max(500, this.w)) * 0.9;
        // rubber band beyond ±25°
        const lim = ROT_MAX;
        this.yaw = Math.abs(raw) <= lim ? raw : Math.sign(raw) * (lim + (Math.abs(raw) - lim) * 0.25);
        const now = performance.now();
        const dtm = Math.max(1, now - lastT);
        vel = lerp(vel, ((p.x - lastX) * (180 / Math.max(500, this.w)) * 0.9) / (dtm / 1000), 0.5);
        lastX = p.x; lastT = now;
        this.yawRest = 0; this.restUntil = 0;
        this.kick(1);
        e.preventDefault();
      }
    };
    const up = (e: PointerEvent) => {
      const ptr = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      clearTimeout(longTimer);
      if (!ptr) return;
      if (mode === 'drag') {
        this.dragging = false;
        this.yawV = clamp(vel, -260, 260); // inertia, then the spring brings it home
        this.kick(2);
      } else if (mode === 'tap' && performance.now() - ptr.t0 < 450) {
        const now = performance.now();
        if (now - lastTap.t < 320 && Math.hypot(ptr.x - lastTap.x, ptr.y - lastTap.y) < 40) {
          lastTap.t = 0;
          void this.focus('reset');
        } else {
          lastTap = { t: now, x: ptr.x, y: ptr.y };
          this.tap(ptr.x, ptr.y);
        }
      }
      if (pointers.size === 0) mode = 'none';
      else if (mode === 'pinch' && pointers.size === 1) mode = 'none';
    };
    const cancel = (e: PointerEvent) => { pointers.delete(e.pointerId); clearTimeout(longTimer); this.dragging = false; mode = 'none'; };
    const leave = () => { if (!pointers.size) { this.tiltT = [0, 0]; this.kick(1); } };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('pointerleave', leave);
    const ctx = (e: Event) => e.preventDefault();
    root.addEventListener('contextmenu', ctx);
    const dbl = (e: MouseEvent) => { e.preventDefault(); void this.focus('reset'); };
    root.addEventListener('dblclick', dbl);
    // device tilt (Android without permission; iOS only if already granted elsewhere)
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      this.tiltT = [clamp(e.gamma / 30) * 4, clamp((e.beta - 45) / 40) * -2.2];
      if (this.motion) this.kick(0.5);
    };
    if (env.isTouch) window.addEventListener('deviceorientation', orient);
    const vis = () => { this.paused.hidden = document.hidden; if (!document.hidden) this.kick(1); };
    document.addEventListener('visibilitychange', vis);
    this.paused.hidden = document.hidden;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => { this.paused.offscreen = !en[0]?.isIntersecting; if (!this.paused.offscreen) this.kick(1); }, { threshold: 0 });
      io.observe(this.container!);
    }
    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => {
        const r = this.container!.getBoundingClientRect();
        if (Math.round(r.width) === this.w && Math.round(r.height) === this.h) return;
        this.measure();
        this.camFit = null;
        this.ensureModel();
        this.kick(1);
      });
      ro.observe(this.container!);
    }
    const offMotion = bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => {
      this.motion = allowed;
      this.root.dataset.motion = allowed ? 'on' : 'off';
      this.engraver?.setMotion(allowed);
      if (!allowed) {
        if (this.birth.active) this.skipBirth();
        this.a.fog = 0; this.a.appear = 1; this.a.breathe = 1;
        this.falling.length = 0;
        if (this.kindNow === 'webgl') this.switchToSvg();
      } else if (this.webglAllowed()) void this.loadGL();
      this.kick(1);
    });
    this.disposers.push(() => {
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('pointerleave', leave); root.removeEventListener('contextmenu', ctx); root.removeEventListener('dblclick', dbl);
      window.removeEventListener('deviceorientation', orient);
      document.removeEventListener('visibilitychange', vis);
      io?.disconnect(); ro?.disconnect(); offMotion();
      clearTimeout(longTimer); clearTimeout(this.hsPendingTimer);
    });
  }

  /** what is under a point (CSS px in the scene) */
  private pick(x: number, y: number): { kind: Hotspot['kind']; id: string; index?: number } | null {
    const f = this.lastFrame;
    if (!f) return null;
    const P = this.proj, G = f.grow, M = this.model, s = this.state, t = this.tmp;
    const planted = s.planted;
    // greeting leaves
    if (planted) for (let i = 0; i < s.greetings.length; i++) {
      const h = this.hotspots.find((q) => q.id === `greeting-${s.greetings[i].id}`);
      if (h && h.visible && Math.hypot(h.x - x, h.y - y) < 20) return { kind: 'greeting', id: h.id, index: i };
    }
    // fruits
    if (planted && G.fruitCount) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < G.fruitCount; k++) {
        const i = G.fruits[k];
        P.tree(G.fruitXYZ[k * 3], G.fruitXYZ[k * 3 + 1], G.fruitXYZ[k * 3 + 2], t);
        const r = Math.max(16, M.fruits.size[i] * G.s * P.pxPerUnit(t[2]));
        const d = Math.hypot(t[0] - x, t[1] - y);
        if (d < r && d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return { kind: 'fruit', id: `fruit-${best}`, index: best };
    }
    // plaque (projected quad) & token
    if (planted && f.a.plaqueRise > 0.5) {
      const q: [number, number][] = [];
      for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        P.island(PLAQUE.x + u * PLAQUE.w, PLAQUE.y + v * PLAQUE.h, PLAQUE.z, t);
        q.push([t[0], t[1]]);
      }
      if (inPoly(x, y, q)) return { kind: 'plaque', id: 'plaque' };
      P.island(TOKEN.x, TOKEN.y, TOKEN.z, t);
      if (Math.hypot(t[0] - x, t[1] - y) < Math.max(16, TOKEN.r * P.pxPerUnit(t[2]) + 6)) return { kind: 'qr', id: 'qr' };
    }
    // trunk
    if (planted && G.trunk.length > 1) {
      let prev: [number, number] | null = null;
      for (const tr of G.trunk) {
        P.tree(tr.x, tr.y, tr.z, t);
        const cur: [number, number] = [t[0], t[1]];
        const rpx = Math.max(12, tr.r * P.pxPerUnit(t[2]) + 8);
        if (prev && segDist(x, y, prev, cur) < rpx) return { kind: 'trunk', id: 'trunk' };
        prev = cur;
      }
    }
    // crown
    if (planted && G.leafCount > 0) {
      P.tree(G.crownC[0], G.crownC[1], G.crownC[2], t);
      const r = G.crownR * P.pxPerUnit(t[2]);
      if (Math.hypot((t[0] - x) / r, (t[1] - y) / (r * 0.9)) < 1) return { kind: 'leaf', id: 'leaf' };
    }
    // ground: top cap or the cut face
    const I = M.island;
    const face: [number, number][] = [];
    for (const row of I.face) { P.island(row.xr, row.y, ISLAND.ZC, t); face.push([t[0], t[1]]); }
    for (let i = I.face.length - 1; i >= 0; i--) { P.island(I.face[i].xl, I.face[i].y, ISLAND.ZC, t); face.push([t[0], t[1]]); }
    if (inPoly(x, y, face)) return { kind: 'ground', id: 'ground' };
    const top: [number, number][] = [];
    for (let k = 0; k < 32; k++) {
      const an = (k / 32) * TAU, r = I.rimR(an);
      P.island(Math.cos(an) * r, 0, Math.min(ISLAND.ZC, Math.sin(an) * r), t);
      top.push([t[0], t[1]]);
    }
    if (inPoly(x, y, top)) return { kind: 'ground', id: 'ground' };
    return null;
  }

  private tap(x: number, y: number) {
    const hit = this.pick(x, y);
    if (!hit) {
      if (this.focusState.kind !== 'reset' || this.zoomTarget > 1) void this.focus('reset');
      return;
    }
    const hs = this.hotspots.find((h) => h.id === hit.id) ?? { id: hit.id, kind: hit.kind, x, y, visible: true, label: '' };
    switch (hit.kind) {
      case 'trunk': this.shake(); break;
      case 'plaque': case 'qr': void this.focus('plaque'); break;
      case 'fruit': this.swingFruit(hit.index ?? 0); break;
      case 'greeting': this.pulseGreeting(hit.index ?? 0); break;
      case 'leaf': this.rustleCrown(); break;
      case 'ground': return; // the ground answers a long press
    }
    this.emit('hotspot', { ...hs, x: Math.round(hs.x), y: Math.round(hs.y) });
  }

  private longPress(x: number, y: number) {
    const hit = this.pick(x, y);
    if (!hit || hit.kind !== 'ground') return;
    // the roots answer: a soft glow from the tips
    this.glowRoots();
    navigator.vibrate?.(12);
    const hs = this.hotspots.find((h) => h.id === 'ground');
    this.emit('hotspot', { ...(hs ?? { id: 'ground', kind: 'ground', label: 'האדמה והשורשים', visible: true }), x: Math.round(x), y: Math.round(y) });
  }

  private glowRoots() {
    if (!this.motion) return;
    gsap.timeline({ onUpdate: () => this.kick() })
      .fromTo(this.a, { rootGlow: 0 }, { rootGlow: 1, duration: 0.8 * this.slow(), ease: 'power2.inOut' }, 0)
      .to(this.a, { rootGlowA: 0.75, duration: 0.25 }, 0)
      .to(this.a, { rootGlowA: 0, duration: 1.2 }, 1.6 * this.slow());
  }

  /** the visible answer of a tap, asked for from the DOM (keyboard proxies) — no 'hotspot' event is emitted */
  private poke(id: string) {
    if (!this.mounted || this.birth.active) return;
    const kind = this.hotspots.find((q) => q.id === id)?.kind
      ?? (id.startsWith('fruit-') ? 'fruit' : id.startsWith('greeting-') ? 'greeting' : id);
    switch (kind) {
      case 'fruit': { const i = Number(id.slice(6)); if (Number.isFinite(i)) this.swingFruit(i); break; }
      case 'greeting': {
        const gi = this.state.greetings.findIndex((g) => `greeting-${g.id}` === id);
        if (gi >= 0) this.pulseGreeting(gi);
        break;
      }
      case 'trunk': this.shake(); break;
      case 'leaf': this.rustleCrown(); break;
      case 'plaque': case 'qr': void this.focus('plaque'); break;
      case 'ground': this.glowRoots(); break;
      default: break;
    }
  }

  private swingFruit(i: number) {
    this.a.fruitSwing = i;
    if (!this.motion) return;
    gsap.fromTo(this.a, { fruitSwingA: 1 }, { fruitSwingA: 0, duration: 1.8 * this.slow(), ease: 'power2.out', overwrite: 'auto', onUpdate: () => this.kick() });
  }
  private pulseGreeting(i: number) {
    this.a.greetPulse = i;
    sound.play('sparkle', { volume: 0.5 });
    if (!this.motion) return;
    gsap.fromTo(this.a, { greetPulseA: 1 }, { greetPulseA: 0, duration: 1.4 * this.slow(), ease: 'power2.out', overwrite: 'auto', onUpdate: () => this.kick() });
  }
  private rustleCrown() {
    sound.play('rustle', { volume: 0.45 });
    if (!this.motion) return;
    this.shakeT0 = this.clock; this.shakeAmp = 0.35 * (Math.random() < 0.5 ? -1 : 1);
    this.kick(2);
  }

  /* ================================================================ events */
  private on(ev: string, cb: Listener) {
    (this.listeners.get(ev) ?? this.listeners.set(ev, new Set()).get(ev)!).add(cb);
    return () => { this.listeners.get(ev)?.delete(cb); };
  }
  private emit(ev: string, payload: unknown) {
    this.listeners.get(ev)?.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
  }

  /* ================================================================ snapshot */
  private async snapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const W = Math.max(16, Math.round(width)), H = Math.max(16, Math.round(height));
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx || !this.mounted) return out;
    const f0 = this.lastFrame ?? this.buildFrame(0);
    const L = f0.look;
    // paper
    ctx.fillStyle = css(L.bg); ctx.fillRect(0, 0, W, H);
    const gx = L.glowX * W, gy = L.glowY * H * 0.8, gr = Math.max(W, H) * L.glowR;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, css(L.glow, L.glowA)); grad.addColorStop(0.4, css(L.glow, L.glowA * 0.35)); grad.addColorStop(1, css(L.glow, 0));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // a projection framed for the share format (island centred)
    const proj = new Projector();
    const comp = { cx: W / 2, cy: H * (H > W * 1.3 ? 0.47 : 0.52), fracH: H > W * 1.3 ? 0.6 : 0.8, fracW: 0.84, portrait: H > W };
    const box = this.contentBox(f0.grow);
    const ft = fit(box.min, box.max, comp, W, H, FOV, PITCH);
    proj.update({ ...ft, pitch: PITCH, fov: FOV, zoom: 1, w: W, h: H, cx: comp.cx, cy: comp.cy }, { yaw: this.yaw * DEG, tilt: 0, bob: 0, treeScale: 1 });
    const f: Frame = { ...f0, proj, w: W, h: H, dpr: 1 };
    try {
      const layer = await this.renderer?.snapshot(f, W, H);
      if (layer) ctx.drawImage(layer, 0, 0, W, H);
    } catch (e) { console.warn('[tree-scene] snapshot', e); }
    // greeting halos + initials, ghost
    drawOverlaySnapshot(ctx, f);
    // paper grain
    try {
      const pat = ctx.createPattern(paperGrain(), 'repeat');
      if (pat) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    } catch { /* ignore */ }
    return out;
  }

  /* ================================================================ dispose */
  private dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.birth.tl?.kill(); this.waterTl?.kill(); this.focusState.tw?.kill();
    gsap.killTweensOf(this.a);
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.svgR?.dispose(); this.glR?.dispose();
    this.svgR = null; this.glR = null; this.renderer = null;
    this.engraver?.destroy();
    this.overlay?.dispose();
    this.root?.remove();
    this.listeners.clear();
  }
}

/* ------------------------------------------------------------------ helpers */
function inPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(x: number, y: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2);
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}

/** screen-reader description: "עץ תאנה, בן 9 חודשים, מתכונן לחורף, הושקה היום" */
export function describe(s: TreeSceneState): string {
  const sp = speciesDef(s.species);
  if (!s.planted) return `עץ ${sp.nameHe}, ממתין לנטיעה`;
  const days = Math.max(0, Math.round(s.ageDays));
  const months = Math.round(days / 30.44);
  let age: string;
  if (days < 30) age = days <= 1 ? 'בן יום' : days === 2 ? 'בן יומיים' : `בן ${days} ימים`;
  else if (months < 12) age = months === 1 ? 'בן חודש' : months === 2 ? 'בן חודשיים' : `בן ${months} חודשים`;
  else { const y = Math.floor(months / 12); age = y === 1 ? 'בן שנה' : y === 2 ? 'בן שנתיים' : `בן ${y} שנים`; }
  const parts = [`עץ ${sp.nameHe}`, age, sp.seasonHe[s.season]];
  if (s.soilMoisture >= 0.5) parts.push('הושקה היום');
  return parts.join(', ');
}

function drawOverlaySnapshot(ctx: CanvasRenderingContext2D, f: Frame) {
  const { proj, grow, model, state, look, a } = f;
  const t: V3 = [0, 0, 0];
  // ghost
  if (a.ghost > 0.05) {
    try {
      const d = ghostPathFor(f);
      if (d) {
        ctx.save(); ctx.setLineDash([4, 6]); ctx.lineWidth = 1.4; ctx.strokeStyle = css(look.ink, 0.6 * a.ghost);
        ctx.stroke(new Path2D(d)); ctx.restore();
      }
    } catch { /* ignore */ }
  }
  // greeting halos + initials
  const L = model.leaves;
  state.greetings.forEach((g, i) => {
    const li = f.greetLeaves[i];
    if (li == null || !state.planted || !grow.leafCount) return;
    const len = L.size[li] * 1.35 * Math.pow(grow.s, 0.45) * 0.5;
    proj.tree(L.x[li] * grow.s + L.dx[li] * len, L.y[li] * grow.s + L.dy[li] * len, L.z[li] * grow.s + L.dz[li] * len, t);
    const r = clamp(len * 2 * proj.pxPerUnit(t[2]) * 0.9, 10, 30);
    if (g.glowing) {
      const gr = ctx.createRadialGradient(t[0], t[1], 0, t[0], t[1], r * 1.5);
      gr.addColorStop(0, 'rgba(247, 232, 196, 0.9)'); gr.addColorStop(0.45, 'rgba(247, 232, 196, 0.4)'); gr.addColorStop(1, 'rgba(247, 232, 196, 0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(t[0], t[1], r * 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = css(mixC([0.42, 0.29, 0.18], [0, 0, 0], 0));
      ctx.font = `500 ${Math.round(clamp(r * 0.62, 9, 15))}px 'Frank Ruhl Libre', serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; (ctx as any).direction = 'rtl';
      ctx.fillText(g.initials, t[0], t[1]);
    }
  });
}
