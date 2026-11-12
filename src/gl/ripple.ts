/* Hover ripple for any image marked [data-gl="ripple"] — a transient View of the single stage.
   On hover the shared canvas is slipped in right after the <picture>/<img> (same box, same radius, same
   transform), the picture "takes a drop of water" where the cursor enters and as it moves, then the canvas
   is handed back once the rings have settled. */
import { LinearFilter, LinearMipmapLinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Texture, Vector2, Vector3, type WebGLRenderer } from 'three';
import { getStage, type View } from './stage';
import { cleanImage } from './hero-wind';
import { QUAD_VERT, RIPPLE_FRAG } from './shaders';

const texCache = new Map<HTMLImageElement, { tex: Texture; src: string; w: number; h: number }>();
const MAX_TEX = 6;

/** texture of what the <img> shows (decoded copy with its true pixel size — see cleanImage) */
async function textureFor(img: HTMLImageElement): Promise<{ tex: Texture; w: number; h: number } | null> {
  const src = img.currentSrc || img.src;
  const hit = texCache.get(img);
  if (hit && hit.src === src) { texCache.delete(img); texCache.set(img, hit); return hit; }
  hit?.tex.dispose(); texCache.delete(img);
  const clean = await cleanImage(img);
  if (!clean) return null;
  const tex = new Texture(clean);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  const entry = { tex, src, w: clean.naturalWidth, h: clean.naturalHeight };
  texCache.set(img, entry);
  while (texCache.size > MAX_TEX) {
    const [k, v] = texCache.entries().next().value as [HTMLImageElement, { tex: Texture }];
    v.tex.dispose(); texCache.delete(k);
  }
  return entry;
}

let quad: Mesh | null = null;
let mat: ShaderMaterial | null = null;
const scene = new Scene();
const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function material() {
  if (mat) return mat;
  mat = new ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: RIPPLE_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uTex: { value: null }, uRes: { value: new Vector2(1, 1) }, uImg: { value: new Vector2(1, 1) },
      uPos: { value: new Vector2(0.5, 0.5) }, uMouse: { value: new Vector2(0.5, 0.5) }, uHover: { value: 0 },
      uTime: { value: 0 }, uDrops: { value: [0, 1, 2, 3].map(() => new Vector3(0, 0, -1)) },
    },
  });
  quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  return mat;
}

function parsePos(v: string): [number, number] {
  const parts = v.split(/\s+/).map((p) => (p.endsWith('%') ? parseFloat(p) / 100 : p === 'left' || p === 'top' ? 0 : p === 'right' || p === 'bottom' ? 1 : 0.5));
  return [parts[0] ?? 0.5, parts[1] ?? 0.5];
}

class Ripple implements View {
  readonly priority = 2;
  readonly transient = true;
  readonly host: HTMLElement;
  private anchor: Element;
  private canvas: HTMLCanvasElement | null = null;
  private hover = 0;
  private hoverTarget = 0;
  private mouse = new Vector2(0.5, 0.5);
  private mouseTarget = new Vector2(0.5, 0.5);
  private drops: Vector3[] = [0, 1, 2, 3].map(() => new Vector3(0, 0, -1));
  private dropI = 0;
  private lastDrop = new Vector2(-1, -1);
  private lastDropT = -1;
  private t = 0;
  private fit: 'cover' | 'fill' = 'cover';
  private pos: [number, number] = [0.5, 0.5];
  tex: { tex: Texture; w: number; h: number } | null = null;
  constructor(readonly img: HTMLImageElement) {
    this.anchor = img.parentElement?.tagName === 'PICTURE' ? img.parentElement : img;
    this.host = (this.anchor.parentElement ?? img.parentElement) as HTMLElement;
  }

  alive() {
    if (!this.tex) return false;
    if (this.hoverTarget > 0 || this.hover > 0.003) return true;
    return this.drops.some((d) => d.z >= 0 && this.t - d.z < 2.2);
  }
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const cs = getComputedStyle(this.img);
    this.fit = cs.objectFit === 'fill' ? 'fill' : 'cover';
    this.pos = parsePos(cs.objectPosition || '50% 50%');
    canvas.style.cssText = 'position:absolute;display:block;pointer-events:none;margin:0;max-width:none;max-height:none;';
    this.anchor.after(canvas);
    this.layout();
  }
  detach() { /* nothing: the stage removes the canvas */ }
  /** place the canvas exactly over the img (layout box, untransformed) and mirror its look */
  private layout() {
    const c = this.canvas; if (!c) return;
    const target = c.offsetParent;
    let x = 0, y = 0; let el: HTMLElement | null = this.img;
    while (el && el !== target) { x += el.offsetLeft + el.clientLeft; y += el.offsetTop + el.clientTop; el = el.offsetParent as HTMLElement | null; }
    if (el !== target) { const a = this.img.getBoundingClientRect(), b = (target as HTMLElement | null)?.getBoundingClientRect(); x = a.left - (b?.left ?? 0); y = a.top - (b?.top ?? 0); }
    const cs = getComputedStyle(this.img);
    Object.assign(c.style, {
      left: `${x}px`, top: `${y}px`, width: `${this.img.offsetWidth}px`, height: `${this.img.offsetHeight}px`,
      borderRadius: cs.borderRadius, transform: cs.transform === 'none' ? '' : cs.transform, transformOrigin: cs.transformOrigin,
      clipPath: cs.clipPath === 'none' ? '' : cs.clipPath,
    });
  }
  size() { return { w: Math.max(2, this.img.offsetWidth), h: Math.max(2, this.img.offsetHeight) }; }
  dpr() { return Math.min(2, window.devicePixelRatio || 1); }

  frame(r: WebGLRenderer, dt: number) {
    this.t += dt;
    const m = material();
    const u = m.uniforms;
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-dt / (this.hoverTarget > this.hover ? 0.25 : 0.5)));
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-dt / 0.1));
    const { w, h } = this.size();
    // the card may scale/transform on hover: follow it
    const cs = getComputedStyle(this.img);
    if (this.canvas) { this.canvas.style.transform = cs.transform === 'none' ? '' : cs.transform; }
    const t = this.tex!;
    u.uTex.value = t.tex;
    u.uRes.value.set(w, h);
    if (this.fit === 'cover') u.uImg.value.set(t.w, t.h); else u.uImg.value.set(w, h);
    u.uPos.value.set(this.pos[0], 1 - this.pos[1]);
    u.uMouse.value.copy(this.mouse);
    u.uHover.value = this.hover;
    u.uTime.value = this.t;
    (u.uDrops.value as Vector3[]).forEach((v, i) => v.copy(this.drops[i]));
    r.render(scene, cam);
  }

  private uv(e: PointerEvent) {
    const b = this.img.getBoundingClientRect();
    return new Vector2((e.clientX - b.left) / Math.max(1, b.width), 1 - (e.clientY - b.top) / Math.max(1, b.height));
  }
  private drop(p: Vector2) {
    this.drops[this.dropI].set(p.x, p.y, this.t);
    this.dropI = (this.dropI + 1) % this.drops.length;
    this.lastDrop.copy(p); this.lastDropT = this.t;
  }
  enter(e: PointerEvent) {
    const p = this.uv(e);
    this.mouseTarget.copy(p);
    if (this.hover < 0.05) this.mouse.copy(p);
    this.hoverTarget = 1;
    this.drop(p);
    getStage().wake();
  }
  move(e: PointerEvent) {
    const p = this.uv(e);
    this.mouseTarget.copy(p);
    if (p.distanceTo(this.lastDrop) > 0.16 && this.t - this.lastDropT > 0.22) this.drop(p);
    getStage().wake();
  }
  leave() { this.hoverTarget = 0; getStage().wake(); }
}

const ripples = new WeakMap<HTMLImageElement, Ripple>();
const live = new Set<Ripple>();
export async function rippleFor(img: HTMLImageElement): Promise<{ enter(e: PointerEvent): void; move(e: PointerEvent): void; leave(): void } | null> {
  if (!img.complete || !img.naturalWidth) return null;
  const stage = getStage();
  if (stage.isLost) return null;
  let r = ripples.get(img);
  if (!r) { r = new Ripple(img); ripples.set(img, r); }
  r.tex = await textureFor(img);
  if (!r.tex) return null;
  if (!live.has(r)) { live.add(r); stage.add(r); }
  return r;
}
export function releaseRipples() {
  const stage = getStage();
  live.forEach((r) => stage.remove(r));
  live.clear();
  texCache.forEach((v) => v.tex.dispose());
  texCache.clear();
}
